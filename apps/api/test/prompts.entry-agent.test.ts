import { afterEach, describe, expect, it } from 'vitest';
import { promptApp } from './prompt-helpers.js';
import { startTcpServer } from './skill-helpers.js';
import { ticket } from './ticket-helpers.js';

/** Agent and decision of each audit entry after the operator and redact entries. */
const agentSteps = (entries: Array<{ agent: string; decision: string }>) =>
  entries
    .filter(({ agent }) => agent !== 'operator' && agent !== 'redact')
    .map(({ agent, decision }) => `${agent}:${decision}`);

describe('prompts.entry-agent', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('starts triage-ticket at the triage agent', async () => {
    const { app, runner, audit } = await promptApp();
    close = () => app.close();

    const { ticketId, done } = await runner.start('triage-ticket', {
      ticket: 'Me equivoqué varias veces y mi cuenta está bloqueada.',
      channel: 'email',
    });
    await done;

    expect(agentSteps(await audit.read(ticketId))[0]).toBe('triage:classified');
  });

  it('starts run-vpn-diagnostics at the diagnostics agent, checking the requested target', async () => {
    const server = await startTcpServer();
    const { app, runner, audit, store } = await promptApp();
    close = async () => {
      await app.close();
      await server.close();
    };
    const existing = ticket({ status: 'TRIAGED', findings: [], actions: [] });
    await store.save(existing);

    const { done } = await runner.start('run-vpn-diagnostics', {
      ticketId: existing.ticketId,
      target: `localhost:${server.port}`,
    });
    const final = await done;

    const steps = agentSteps(await audit.read(existing.ticketId));
    expect(steps[0]).toBe('diagnostics:transition');
    expect(steps).toContain('diagnostics:tool_run');
    expect(final.status).toBe('RESOLVED');
  });

  it('starts escalate-ticket at the escalation agent with operator_request', async () => {
    const { app, runner, audit, store } = await promptApp();
    close = () => app.close();
    const existing = ticket({ status: 'TRIAGED', findings: [], actions: [] });
    await store.save(existing);

    const { done } = await runner.start('escalate-ticket', {
      ticketId: existing.ticketId,
      reason: 'El área pidió revisarlo con prioridad',
    });
    const final = await done;

    expect(agentSteps(await audit.read(existing.ticketId))[0]).toBe('escalation:escalated');
    expect(final.escalationPackage?.reason).toBe('operator_request');
    expect(final.status).toBe('ESCALATED');
  });

  it('answers POST /prompts/:name/run with 202 and the ticketId', async () => {
    const { app, audit } = await promptApp();
    close = () => app.close();
    await app.listen(0);

    const response = await fetch(`${await app.getUrl()}/prompts/triage-ticket/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variables: { ticket: 'La VPN no conecta.', channel: 'portal' } }),
    });

    expect(response.status).toBe(202);
    const { ticketId } = (await response.json()) as { ticketId: string };
    expect(ticketId).toMatch(/^TCK-\d{8}-\d{6}-[0-9a-z]{3}$/);
    expect((await audit.read(ticketId))[0]).toMatchObject({
      agent: 'operator',
      decision: 'prompt_run',
      data: { prompt: 'triage-ticket', agent: 'triage' },
    });
  });
});

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gatedModel } from './gated-model-helpers.js';
import { getJson, postJson, postRun, promptApp, waitForStatus } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

const steps = (entries: Array<{ agent: string; decision: string }>) =>
  entries.map(({ agent, decision }) => `${agent}:${decision}`);

describe('tickets.created-early', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('stores the new ticket in NEW with only its redacted text before triage answers', async () => {
    const { model, release } = await gatedModel();
    const { app, audit, dataDir } = await promptApp(model);
    close = () => app.close();
    await app.listen(0);
    const { body } = await postJson(app, '/tickets', {
      text: 'La VPN no me conecta desde casa. Mi correo es ana.demo@example.com',
      channel: 'portal',
    });
    const ticketId = String(body.ticketId);

    // Triage is held: the detail answers from the ticket that the redact node stored.
    let detail = await getJson(app, `/tickets/${ticketId}`);
    for (let attempt = 0; attempt < 50 && detail.status === 404; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      detail = await getJson(app, `/tickets/${ticketId}`);
    }

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      ticketId,
      status: 'NEW',
      channel: 'portal',
      redactedText: 'La VPN no me conecta desde casa. Mi correo es [EMAIL]',
    });
    expect(detail.body).not.toHaveProperty('rawText');
    const file = await readFile(join(dataDir, 'tickets', `${ticketId}.json`), 'utf8');
    expect(file).not.toContain('ana.demo@example.com');
    // Triage stays held at its LLM call, so its node_started closes the sequence.
    let written = steps(await audit.read(ticketId));
    for (let attempt = 0; attempt < 50 && !written.includes('triage:node_started'); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      written = steps(await audit.read(ticketId));
    }
    expect(written).toEqual([
      'operator:prompt_run',
      'redact:node_started',
      'redact:redacted',
      'redact:ticket_created',
      'redact:node_finished',
      'triage:node_started',
    ]);
    release();
  });

  it('does not create the ticket again in a run over a stored ticket', async () => {
    const { app, audit, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = ticket({ status: 'TRIAGED' });
    await store.save(stored);

    await postRun(app, 'escalate-ticket', {
      ticketId: stored.ticketId,
      reason: 'operator_request',
    });

    expect(await waitForStatus(store, stored.ticketId, ['ESCALATED'])).toBe('ESCALATED');
    expect(steps(await audit.read(stored.ticketId))).not.toContain('redact:ticket_created');
  });
});

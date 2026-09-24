import { afterEach, describe, expect, it } from 'vitest';
import { promptApp } from './prompt-helpers.js';

describe('tickets.create', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('answers 202 with the new ticketId and runs the graph from the redact node', async () => {
    const { app, audit, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);

    const response = await fetch(`${await app.getUrl()}/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'Me equivoqué varias veces y mi cuenta está bloqueada.',
        channel: 'portal',
      }),
    });

    expect(response.status).toBe(202);
    const { ticketId } = (await response.json()) as { ticketId: string };
    expect(ticketId).toMatch(/^TCK-\d{8}-\d{6}-[0-9a-z]{3}$/);
    let status: string | undefined;
    for (let attempt = 0; attempt < 50 && status !== 'RESOLVED'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      status = (await store.read(ticketId))?.status;
    }
    expect(status).toBe('RESOLVED');
    const entries = await audit.read(ticketId);
    expect(entries.slice(0, 7).map(({ agent, decision }) => `${agent}:${decision}`)).toEqual([
      'operator:prompt_run',
      'redact:node_started',
      'redact:redacted',
      'redact:ticket_created',
      'redact:node_finished',
      'triage:node_started',
      'triage:classified',
    ]);
    expect(entries[0]?.data).toMatchObject({ prompt: 'triage-ticket' });
    expect((await store.read(ticketId))?.channel).toBe('portal');
  });
});

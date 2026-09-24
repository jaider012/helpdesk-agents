import { afterEach, describe, expect, it } from 'vitest';
import { postJson, promptApp } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

const ID = 'TCK-20260923-101500-dem';

describe('validation.body', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it.each([
    ['/prompts/triage-ticket/run', { variables: { ticket: 5 } }, 'variables.ticket'],
    ['/tickets', { text: 'La VPN no conecta.', channel: 'fax' }, 'channel'],
    ['/tickets', { channel: 'chat' }, 'text'],
    [`/tickets/${ID}/reply`, { issueType: 'printer' }, 'issueType'],
    [`/tickets/${ID}/close`, { closeReason: 42 }, 'closeReason'],
  ])('answers 400 with the validation errors for POST %s', async (path, body, field) => {
    const { app, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    await store.save(ticket({ status: 'WAITING_USER' }));

    const response = await postJson(app, path, body);

    expect(response.status).toBe(400);
    const errors = response.body.errors as Array<{ path: string; message: string }>;
    expect(errors.map(({ path: errorPath }) => errorPath)).toContain(field);
    expect(errors.every(({ message }) => message.length > 0)).toBe(true);
  });
});

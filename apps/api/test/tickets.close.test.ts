import { afterEach, describe, expect, it } from 'vitest';
import { postJson, promptApp } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('tickets.close', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it.each([
    ['RESOLVED', 'user_confirmed'],
    ['ESCALATED', 'handled_by_team'],
  ] as const)('closes a ticket in %s with its closeReason', async (from, closeReason) => {
    const { app, store, audit } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = ticket({ status: from, userMessage: 'Mensaje de prueba.' });
    await store.save(stored);

    const { status, body } = await postJson(app, `/tickets/${stored.ticketId}/close`, {
      closeReason,
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'CLOSED', closeReason });
    expect((await store.read(stored.ticketId))?.status).toBe('CLOSED');
    expect((await audit.read(stored.ticketId)).at(-1)).toMatchObject({
      agent: 'operator',
      decision: 'transition',
      from,
      to: 'CLOSED',
    });
  });

  it('answers 409 with the code when the ticket cannot be closed from its status', async () => {
    const { app, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = ticket({ status: 'IN_PROGRESS' });
    await store.save(stored);

    const { status, body } = await postJson(app, `/tickets/${stored.ticketId}/close`, {
      closeReason: 'user_confirmed',
    });

    expect(status).toBe(409);
    expect(body).toMatchObject({ code: 'INVALID_TRANSITION' });
    expect((await store.read(stored.ticketId))?.status).toBe('IN_PROGRESS');
  });

  it('answers 400 for a closeReason outside the list and 404 for an unknown ticket', async () => {
    const { app, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = ticket({ status: 'RESOLVED' });
    await store.save(stored);

    expect(
      (await postJson(app, `/tickets/${stored.ticketId}/close`, { closeReason: 'bored' })).status,
    ).toBe(400);
    expect(
      (
        await postJson(app, '/tickets/TCK-20260923-101500-zzz/close', {
          closeReason: 'user_confirmed',
        })
      ).status,
    ).toBe(404);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { postJson, promptApp, waitForStatus } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

const waiting = () =>
  ticket({
    status: 'WAITING_USER',
    category: 'access',
    entities: { userRef: 'usr_a1b2c3d4', issueType: 'unknown', businessImpact: 'medium' },
    findings: [],
    actions: [],
    userMessage: 'Necesitamos un dato más.',
  });

describe('tickets.reply', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('resumes the graph at the diagnostics agent with the issue type of the reply', async () => {
    const { app, store, audit } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = waiting();
    await store.save(stored);

    const { status, body } = await postJson(app, `/tickets/${stored.ticketId}/reply`, {
      issueType: 'lockout',
    });

    expect(status).toBe(202);
    expect(body).toEqual({ ticketId: stored.ticketId });
    expect(await waitForStatus(store, stored.ticketId, ['RESOLVED', 'ESCALATED'])).toBe('RESOLVED');
    const steps = (await audit.read(stored.ticketId)).map(
      ({ agent, decision, from, to }) => `${agent}:${decision}${from ? `:${from}→${to}` : ''}`,
    );
    expect(steps[0]).toBe('runtime:transition:WAITING_USER→IN_PROGRESS');
    expect(steps).toContain('diagnostics:action_executed');
    expect((await store.read(stored.ticketId))?.entities?.issueType).toBe('lockout');
  });

  it('answers 409 when the ticket is not waiting for the user', async () => {
    const { app, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = ticket({ status: 'TRIAGED' });
    await store.save(stored);

    const { status, body } = await postJson(app, `/tickets/${stored.ticketId}/reply`, {
      issueType: 'vpn',
    });

    expect(status).toBe(409);
    expect(body).toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it.each([{ issueType: 'unknown' }, { issueType: 'printer' }, {}])(
    'answers 400 for the body %j',
    async (payload) => {
      const { app, store } = await promptApp();
      close = () => app.close();
      await app.listen(0);
      const stored = waiting();
      await store.save(stored);

      expect((await postJson(app, `/tickets/${stored.ticketId}/reply`, payload)).status).toBe(400);
      expect((await store.read(stored.ticketId))?.status).toBe('WAITING_USER');
    },
  );
});

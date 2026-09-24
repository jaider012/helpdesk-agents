import { afterEach, describe, expect, it } from 'vitest';
import { getJson, promptApp } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('tickets.audit', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('returns the audit entries of the ticket in write order', async () => {
    const { app, store, audit } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = ticket();
    await store.save(stored);
    for (const decision of ['redacted', 'classified', 'routed'] as const) {
      await audit.append({
        ticketId: stored.ticketId,
        agent: 'triage',
        decision,
        reason: decision,
      });
    }

    const { status, body } = await getJson(app, `/tickets/${stored.ticketId}/audit`);

    expect(status).toBe(200);
    expect(
      (body as Array<{ seq: number; decision: string }>).map(({ seq, decision }) => [
        seq,
        decision,
      ]),
    ).toEqual([
      [1, 'redacted'],
      [2, 'classified'],
      [3, 'routed'],
    ]);
  });

  it('answers 404 for an unknown ticket', async () => {
    const { app } = await promptApp();
    close = () => app.close();
    await app.listen(0);

    expect((await getJson(app, '/tickets/TCK-20260923-101500-zzz/audit')).status).toBe(404);
  });
});

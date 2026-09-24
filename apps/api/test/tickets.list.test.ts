import { afterEach, describe, expect, it } from 'vitest';
import { getJson, promptApp } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('tickets.list', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('returns every ticket with ticketId, category, severity, status and slaDueAt, newest first', async () => {
    const { app, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    await store.save(
      ticket({
        ticketId: 'TCK-20260923-101500-aaa',
        createdAt: '2026-09-23T10:15:00.000Z',
        slaDueAt: '2026-09-24T10:15:00.000Z',
      }),
    );
    await store.save(
      ticket({
        ticketId: 'TCK-20260923-111500-bbb',
        createdAt: '2026-09-23T11:15:00.000Z',
        category: 'access',
        severity: 'P1',
        status: 'ESCALATED',
        slaDueAt: '2026-09-23T15:15:00.000Z',
      }),
    );

    const { status, body } = await getJson(app, '/tickets');

    expect(status).toBe(200);
    expect(body).toEqual([
      {
        ticketId: 'TCK-20260923-111500-bbb',
        category: 'access',
        severity: 'P1',
        status: 'ESCALATED',
        slaDueAt: '2026-09-23T15:15:00.000Z',
        createdAt: '2026-09-23T11:15:00.000Z',
      },
      {
        ticketId: 'TCK-20260923-101500-aaa',
        category: 'infra',
        severity: 'P3',
        status: 'NEW',
        slaDueAt: '2026-09-24T10:15:00.000Z',
        createdAt: '2026-09-23T10:15:00.000Z',
      },
    ]);
  });

  it('returns an empty list when there are no tickets', async () => {
    const { app } = await promptApp();
    close = () => app.close();
    await app.listen(0);

    expect((await getJson(app, '/tickets')).body).toEqual([]);
  });
});

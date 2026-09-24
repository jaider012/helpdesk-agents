import { afterEach, describe, expect, it } from 'vitest';
import { getJson, promptApp } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('tickets.detail', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('returns the TicketState of the ticket, without the audit', async () => {
    const { app, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = ticket({ status: 'RESOLVED', userMessage: 'Mensaje de prueba.' });
    await store.save(stored);

    const { status, body } = await getJson(app, `/tickets/${stored.ticketId}`);

    expect(status).toBe(200);
    const withoutAudit: Partial<typeof stored> = { ...stored };
    delete withoutAudit.audit;
    expect(body).toEqual(withoutAudit);
  });

  it.each(['TCK-20260923-101500-zzz', '..%2F..%2Fetc%2Fpasswd'])(
    'answers 404 for «%s»',
    async (id) => {
      const { app } = await promptApp();
      close = () => app.close();
      await app.listen(0);

      expect((await getJson(app, `/tickets/${id}`)).status).toBe(404);
    },
  );
});

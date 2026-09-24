import { describe, expect, it } from 'vitest';
import { ESCALATED_TEMPLATE, escalateWithMessage, realGuard, TICKET } from './guard-helpers.js';

const context = { ticketId: TICKET, status: 'RESOLVED' as const };

describe('guard.internal-data', () => {
  it.each(['Tu referencia es usr_a1b2c3d4.', 'Datos: {"category":"infra"}'])(
    'fires on «%s»',
    async (text) => {
      expect((await realGuard()).check(text, context)).toBe('internal_data');
    },
  );

  it('fires when an escalated message lacks the ticketId', async () => {
    expect(
      (await realGuard()).check('Te contactaremos pronto.', { ...context, status: 'ESCALATED' }),
    ).toBe('ticket_id_missing');
  });

  it('replaces a drafted message with a userRef with the template', async () => {
    const { final, replaced } = await escalateWithMessage(
      (ticketId) => `Caso ${ticketId} del usuario usr_a1b2c3d4 asignado.`,
    );

    expect(final.userMessage).toBe(ESCALATED_TEMPLATE);
    expect(replaced).toMatchObject({ data: { cause: 'internal_data' } });
  });
});

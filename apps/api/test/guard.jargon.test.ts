import { describe, expect, it } from 'vitest';
import { ESCALATED_TEMPLATE, escalateWithMessage, realGuard, TICKET } from './guard-helpers.js';

const context = { ticketId: TICKET, status: 'RESOLVED' as const };

describe('guard.jargon', () => {
  it.each([
    'El gateway no responde por TCP.',
    'La LATENCIA es alta.',
    'Revisamos la dirección IP.',
  ])('fires on «%s»', async (text) => {
    expect((await realGuard()).check(text, context)).toBe('jargon');
  });

  it.each(['Cierra la VPN y vuelve a abrirla.', 'Usa el hashtag del equipo.'])(
    'does not fire on «%s»',
    async (text) => {
      expect((await realGuard()).check(`${text} Caso ${TICKET}.`, context)).toBeUndefined();
    },
  );

  it('replaces a drafted message with jargon with the template', async () => {
    const { final, replaced } = await escalateWithMessage(
      (ticketId) => `Caso ${ticketId}: el gateway no responde por TCP.`,
    );

    expect(final.userMessage).toBe(ESCALATED_TEMPLATE);
    expect(replaced).toMatchObject({ data: { cause: 'jargon' } });
  });
});

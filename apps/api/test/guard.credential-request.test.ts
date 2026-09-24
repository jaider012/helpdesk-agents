import { describe, expect, it } from 'vitest';
import { ESCALATED_TEMPLATE, escalateWithMessage, realGuard, TICKET } from './guard-helpers.js';

const context = { ticketId: TICKET, status: 'RESOLVED' as const };

describe('guard.credential-request', () => {
  it.each([
    'Envía el código MFA que ves en tu teléfono.',
    'Dime tu clave para revisar la cuenta.',
    'Escribe la clave de acceso aquí.',
    'Indica el código del caso y tu contraseña.',
    'Indica los códigos del caso.',
    'Comparte tu token de acceso.',
  ])('fires on «%s»', async (text) => {
    expect((await realGuard()).check(text, context)).toBe('credential_request');
  });

  it.each(['Indica el código del caso al responder.', 'Indica el paso clave que falló.'])(
    'does not fire on «%s»',
    async (text) => {
      expect((await realGuard()).check(`${text} Caso ${TICKET}.`, context)).toBeUndefined();
    },
  );

  it('replaces a drafted message that asks for the password with the template', async () => {
    const { final, replaced } = await escalateWithMessage(
      (ticketId) => `Caso ${ticketId}: envía tu contraseña para revisar la cuenta.`,
    );

    expect(final.userMessage).toBe(ESCALATED_TEMPLATE);
    expect(replaced).toMatchObject({ agent: 'escalation', data: { cause: 'credential_request' } });
  });
});

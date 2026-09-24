import { describe, expect, it } from 'vitest';
import { redact } from '../src/redact/redact.js';

describe('redact.identity', () => {
  it.each([
    ['Mi cédula: 1020304050', 'Mi [ID]'],
    ['DNI 12345678', '[ID]'],
  ])('replaces the identity document in «%s» with [ID]', (text, expected) => {
    expect(redact(text)).toEqual({ text: expected, counts: { ID: 1 } });
  });

  it.each([
    ['Mi usuario es ana.demo y no entra', 'Mi usuario: [USER] y no entra'],
    ['login: jdoe_01', 'login: [USER]'],
  ])('replaces the login name in «%s» with [USER]', (text, expected) => {
    expect(redact(text)).toEqual({ text: expected, counts: { USER: 1 } });
  });

  it.each(['Mi usuario está bloqueado', 'El userRef no se toca'])(
    'keeps text without a login name: «%s»',
    (text) => {
      expect(redact(text).text).toBe(text);
    },
  );

  it('redacts the synthetic ticket F of the manual tests', () => {
    expect(
      redact('No puedo entrar a la VPN. Mi usuario es ana.demo y mi contraseña: Ejemplo123!'),
    ).toEqual({
      text: 'No puedo entrar a la VPN. Mi usuario: [USER] y mi contraseña: [SECRET]',
      counts: { SECRET: 1, USER: 1 },
    });
  });
});

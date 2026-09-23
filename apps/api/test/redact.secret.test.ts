import { describe, expect, it } from 'vitest';
import { redact } from '../src/redact/redact.js';

describe('redact.secret', () => {
  it.each([
    ['Mi password: Ejemplo123!', 'Mi password: [SECRET]'],
    ['contraseña=Ejemplo123!', 'contraseña: [SECRET]'],
    ['Mi contraseña es Ejemplo123! y no entra', 'Mi contraseña: [SECRET] y no entra'],
    ['la clave es 4321', 'la clave: [SECRET]'],
    ['PIN: 1234', 'PIN: [SECRET]'],
    ['secret = abc', 'secret: [SECRET]'],
  ])('replaces the credential in «%s»', (text, expected) => {
    expect(redact(text)).toEqual({ text: expected, counts: { SECRET: 1 } });
  });

  it.each(['Olvidé mi contraseña', 'Ese es el punto clave', 'La clave del problema es la VPN'])(
    'keeps text that names a credential without giving it: «%s»',
    (text) => {
      expect(redact(text).text).toBe(text);
    },
  );

  it('does not replace a placeholder left by an earlier pattern', () => {
    expect(redact(`token: ${'z'.repeat(40)}`).text).toBe('token: [TOKEN]');
  });
});

import { describe, expect, it } from 'vitest';
import { redact } from '../src/redact/redact.js';

describe('redact.phone', () => {
  it.each(['+57 300 123 4567', '(601) 555-0199', '3001234567', '300-123-45-67'])(
    'replaces the phone number %s with [PHONE]',
    (phone) => {
      expect(redact(`Llámame al ${phone} hoy.`)).toEqual({
        text: 'Llámame al [PHONE] hoy.',
        counts: { PHONE: 1 },
      });
    },
  );

  it.each([
    'Caso TCK-20260923-101500-a1b abierto',
    'El servidor 10.0.0.1 responde',
    'Usa el puerto 8443 del año 2026',
  ])('keeps numbers that are not phone numbers: %s', (text) => {
    expect(redact(text).text).toBe(text);
  });
});

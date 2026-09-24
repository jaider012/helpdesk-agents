import { describe, expect, it } from 'vitest';
import { redact } from '../src/redact/redact.js';

describe('redact.email', () => {
  it('replaces every email address with [EMAIL] and counts them', () => {
    const result = redact(
      'Soy ana.demo@example.com; copia a jefe.demo+vpn@example.internal por favor.',
    );

    expect(result.text).toBe('Soy [EMAIL]; copia a [EMAIL] por favor.');
    expect(result.counts).toEqual({ EMAIL: 2 });
  });

  it('leaves text without email addresses unchanged', () => {
    expect(redact('La VPN no conecta desde las 8 a. m.')).toEqual({
      text: 'La VPN no conecta desde las 8 a. m.',
      counts: {},
    });
  });
});

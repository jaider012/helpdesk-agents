import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MISSING_SALT_WARNING,
  redactTicket,
  resolveRedactionSalt,
} from '../src/redact/redact-node.js';

const SALT = 'synthetic-test-salt';
const hmac8 = (id: string, salt = SALT) =>
  createHmac('sha256', salt).update(id).digest('hex').slice(0, 8);

describe('redact.userref', () => {
  it('stores usr_<hash> of the first email in entities.userRef', () => {
    const output = redactTicket('Soy ana.demo@example.com, copia a jefe.demo@example.com', SALT);

    expect(output.entities.userRef).toBe(`usr_${hmac8('ana.demo@example.com')}`);
    expect(output.entities.userRef).toMatch(/^usr_[0-9a-f]{8}$/);
  });

  it('normalizes the identifier before hashing (lowercase, trimmed)', () => {
    expect(redactTicket('Soy Ana.Demo@Example.COM', SALT).entities.userRef).toBe(
      redactTicket('soy ana.demo@example.com', SALT).entities.userRef,
    );
  });

  it('uses the first login name when there is no email', () => {
    expect(redactTicket('Mi usuario es Ana.Demo y no entra', SALT).entities.userRef).toBe(
      `usr_${hmac8('ana.demo')}`,
    );
  });

  it('stores usr_unknown when the text has no identifier', () => {
    expect(redactTicket('La VPN no conecta', SALT).entities.userRef).toBe('usr_unknown');
  });

  it('keeps the userRef stable for the same salt and changes it with another salt', () => {
    const text = 'Soy ana.demo@example.com';

    expect(redactTicket(text, SALT).entities.userRef).toBe(
      redactTicket(text, SALT).entities.userRef,
    );
    expect(redactTicket(text, 'another-salt').entities.userRef).not.toBe(
      redactTicket(text, SALT).entities.userRef,
    );
  });

  it('leaves the original identifier out of the node output', () => {
    const output = redactTicket('Soy ana.demo@example.com. Mi usuario es ana.demo', SALT);

    expect(JSON.stringify(output)).not.toContain('ana.demo');
    expect(output.redactedText).toBe('Soy [EMAIL]. Mi usuario: [USER]');
    expect(output.counts).toEqual({ EMAIL: 1, USER: 1 });
  });

  it('uses REDACTION_SALT when it is set', () => {
    expect(resolveRedactionSalt({ REDACTION_SALT: SALT })).toEqual({ salt: SALT });
  });

  it('generates a random salt per process with a warning when REDACTION_SALT is missing', () => {
    const first = resolveRedactionSalt({});
    const second = resolveRedactionSalt({ REDACTION_SALT: '' });

    expect(first.warning).toBe(MISSING_SALT_WARNING);
    expect(first.salt).toMatch(/^[0-9a-f]{64}$/);
    expect(second.salt).not.toBe(first.salt);
  });
});

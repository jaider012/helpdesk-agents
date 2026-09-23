import { createHmac, randomBytes } from 'node:crypto';
import { redact, type RedactionResult } from './redact.js';

export const MISSING_SALT_WARNING =
  'REDACTION_SALT is not set: a random salt is used and userRef values change after a restart';

/** HMAC salt of the userRef: `REDACTION_SALT`, or a random one per process with a warning. */
export function resolveRedactionSalt(env: Record<string, string | undefined>): {
  salt: string;
  warning?: string;
} {
  const salt = env.REDACTION_SALT;
  return salt ? { salt } : { salt: randomBytes(32).toString('hex'), warning: MISSING_SALT_WARNING };
}

/** `usr_` + the first 8 hex of HMAC-SHA256(salt, normalized id), or `usr_unknown` (design §8.1). */
export function userRefFor(identifier: string | undefined, salt: string): string {
  const id = identifier?.trim().toLowerCase();
  if (!id) return 'usr_unknown';
  return `usr_${createHmac('sha256', salt).update(id).digest('hex').slice(0, 8)}`;
}

export interface RedactNodeOutput {
  redactedText: string;
  entities: { userRef: string };
  counts: RedactionResult['counts'];
}

/**
 * The redact node: redacts the ticket text and derives the opaque userRef from the first email or,
 * without one, the first login name (REQ-SEC-05). The original values never leave this function.
 */
export function redactTicket(text: string, salt: string): RedactNodeOutput {
  let email: string | undefined;
  let login: string | undefined;
  const { text: redactedText, counts } = redact(text, (kind, match, groups) => {
    if (kind === 'EMAIL') email ??= match;
    if (kind === 'USER') login ??= groups[1];
  });
  return { redactedText, entities: { userRef: userRefFor(email ?? login, salt) }, counts };
}

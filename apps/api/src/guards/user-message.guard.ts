import { findSection, type SpecBundle, type TicketStatus } from 'agent-spec';
import { COPILOT_INSTRUCTIONS } from '../messages/templates.js';

export const JARGON_HEADING = '## Lista de jerga';

/** The guard that fired, in the order of design §8.2; it goes to `message_replaced`. */
export type GuardRule = 'credential_request' | 'jargon' | 'internal_data' | 'ticket_id_missing';

export interface UserMessageContext {
  ticketId: string;
  /** The status the ticket has with this message. */
  status: TicketStatus;
}

export interface UserMessageGuard {
  /** The first rule the message breaks, or undefined when it can reach the user. */
  check(text: string, context: UserMessageContext): GuardRule | undefined;
}

// REQ-SEC-10. Asks for a password, a key with a determiner, a token or a code other than the case
// code; when in doubt it fires, since a false positive only swaps in the template.
const CREDENTIAL_REQUEST =
  /(envía|comparte|indica|dime|escribe).{0,40}(contraseña|(?:tu|su|la|una)\s+clave|token|código(?!\s+del?\s+caso\b))/iu;
// REQ-COM-04: a userRef or a JSON fragment.
const INTERNAL_DATA = /usr_[0-9a-f]{8}|\{"/u;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The jargon terms of `## Lista de jerga`: one `- term` per line. */
export function compileJargon(body: string): string[] {
  const section = findSection(body, JARGON_HEADING);
  if (section === undefined) throw new Error(`no section \`${JARGON_HEADING}\``);
  return section
    .split('\n')
    .map((line) => /^\s*-\s+(.+?)\s*$/.exec(line)?.[1])
    .filter((term): term is string => Boolean(term));
}

/** The guards of design §8.2 over a jargon list (REQ-SEC-10, REQ-COM-02..04). */
export function compileUserMessageGuard(jargon: readonly string[]): UserMessageGuard {
  // Whole words, without case: «hashtag» is not «hash».
  const words = jargon.map((term) => escapeRegExp(term).replace(/\s+/g, '\\s+')).join('|');
  const jargonPattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${words})(?![\\p{L}\\p{N}_])`, 'iu');
  return {
    check(text, { ticketId, status }) {
      if (CREDENTIAL_REQUEST.test(text)) return 'credential_request';
      if (jargon.length > 0 && jargonPattern.test(text)) return 'jargon';
      if (INTERNAL_DATA.test(text)) return 'internal_data';
      if (status === 'ESCALATED' && !text.includes(ticketId)) return 'ticket_id_missing';
      return undefined;
    },
  };
}

export function guardFromBundle(bundle: SpecBundle): UserMessageGuard {
  const file = bundle.files.find(({ path }) => path === COPILOT_INSTRUCTIONS);
  if (!file?.frontmatter.ok) throw new Error(`${COPILOT_INSTRUCTIONS} is missing or invalid`);
  return compileUserMessageGuard(compileJargon(file.frontmatter.body));
}

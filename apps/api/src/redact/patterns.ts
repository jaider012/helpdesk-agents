export type Placeholder = 'TOKEN' | 'SECRET' | 'EMAIL' | 'PHONE' | 'ID' | 'USER';

export interface RedactionPattern {
  kind: Placeholder;
  /** Global regular expression. */
  regex: RegExp;
  replace: (match: string, ...groups: string[]) => string;
}

// An earlier placeholder such as `[TOKEN]` is never redacted again.
const NOT_A_PLACEHOLDER = '(?!\\[[A-Z]+\\])';
const placeholder = (kind: Placeholder) => () => `[${kind}]`;
const keepWord = (kind: Placeholder) => (_match: string, word: string) => `${word}: [${kind}]`;

/**
 * Redaction patterns of design §8.1, applied in this order. Deviations logged in
 * docs/decisiones-para-revisar.md: the identity document goes before the phone number (DC-35) and
 * pattern 7 also accepts «usuario es <nombre>» (DC-36).
 */
export const REDACTION_PATTERNS: readonly RedactionPattern[] = [
  // 1. JWT.
  { kind: 'TOKEN', regex: /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, replace: placeholder('TOKEN') },
  // 2. Bearer tokens, known key prefixes and long random strings.
  {
    kind: 'TOKEN',
    regex: /\b(Bearer)\s+[\w.~+/=-]+/gi,
    replace: (_match, word) => `${word} [TOKEN]`,
  },
  {
    kind: 'TOKEN',
    regex: /\b(?:sk-|ghp_|xox[abp]-)[\w-]{8,}|\bAKIA[0-9A-Z]{12,}/g,
    replace: placeholder('TOKEN'),
  },
  { kind: 'TOKEN', regex: /(?<![\w-])[\w-]{32,}(?![\w-])/g, replace: placeholder('TOKEN') },
  // 3. Credentials: `password: …`, `clave=…`, «mi contraseña es …».
  {
    kind: 'SECRET',
    regex: new RegExp(
      `\\b(password|passwd|pwd|contraseña|contrasena|clave|pin|secret|token)\\s*[:=]\\s*${NOT_A_PLACEHOLDER}\\S+`,
      'giu',
    ),
    replace: keepWord('SECRET'),
  },
  {
    kind: 'SECRET',
    regex: new RegExp(`\\b(contraseña|contrasena|clave) es ${NOT_A_PLACEHOLDER}\\S+`, 'giu'),
    replace: keepWord('SECRET'),
  },
  // 4. Email addresses.
  { kind: 'EMAIL', regex: /[\w.%+-]+@[\w-]+(?:\.[\w-]+)+/g, replace: placeholder('EMAIL') },
  // 6. Identity documents (before phone numbers, which would take their digits).
  { kind: 'ID', regex: /\b(?:cédula|cedula|cc|dni)\s*:?\s*\d{6,}/giu, replace: placeholder('ID') },
  // 5. Phone numbers: 8 digits or more, with `+`, spaces, hyphens or parentheses.
  {
    kind: 'PHONE',
    regex: /(?<![\w-])\+?\(?\d(?:[\s()-]*\d){7,}(?![\w-])/g,
    replace: placeholder('PHONE'),
  },
  // 7. Login names: `usuario: x`, `user=x`, «usuario es x».
  {
    kind: 'USER',
    regex:
      /\b(usuario|user|login)\b(?:\s*[:=]\s*|\s+es\s+|\s+)[a-z0-9._-]{3,}(?![\p{L}\p{N}._-])/giu,
    replace: keepWord('USER'),
  },
];

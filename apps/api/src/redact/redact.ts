import { REDACTION_PATTERNS, type Placeholder } from './patterns.js';

export interface RedactionResult {
  text: string;
  /** Replacements per placeholder type; the audit log stores only these counts (design §8.1). */
  counts: Partial<Record<Placeholder, number>>;
}

/** Replaces personal data and secrets with placeholders before any LLM call (REQ-SEC-01..04). */
export function redact(text: string): RedactionResult {
  const counts: Partial<Record<Placeholder, number>> = {};
  let result = text;
  for (const { kind, regex, replace } of REDACTION_PATTERNS) {
    result = result.replace(regex, (match: string, ...groups: string[]) => {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return replace(match, ...groups);
    });
  }
  return { text: result, counts };
}

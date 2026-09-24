import { REDACTION_PATTERNS, type Placeholder } from './patterns.js';

export interface RedactionResult {
  text: string;
  /** Replacements per placeholder type; the audit log stores only these counts (design §8.1). */
  counts: Partial<Record<Placeholder, number>>;
}

/** Receives each original match, e.g. to derive the userRef; its values must not be stored. */
export type RedactionObserver = (kind: Placeholder, match: string, groups: string[]) => void;

/** Replaces personal data and secrets with placeholders before any LLM call (REQ-SEC-01..04). */
export function redact(text: string, observe?: RedactionObserver): RedactionResult {
  const counts: Partial<Record<Placeholder, number>> = {};
  let result = text;
  for (const { kind, regex, replace } of REDACTION_PATTERNS) {
    result = result.replace(regex, (match: string, ...groups: string[]) => {
      counts[kind] = (counts[kind] ?? 0) + 1;
      observe?.(kind, match, groups);
      return replace(match, ...groups);
    });
  }
  return { text: result, counts };
}

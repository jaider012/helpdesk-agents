/** Longest subject shown as the ticket title, in characters. */
const MAX_SUBJECT = 90;

/**
 * A short title for the ticket: the first sentence of its redacted text, without the final period.
 * The ticket has no title of its own (specs/design.md §4); an empty text gives an empty subject.
 */
export function subjectOf(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? trimmed : trimmed.slice(0, trimmed[end] === '.' ? end : end + 1);
  return sentence.length > MAX_SUBJECT
    ? `${sentence.slice(0, MAX_SUBJECT - 1).trimEnd()}…`
    : sentence;
}

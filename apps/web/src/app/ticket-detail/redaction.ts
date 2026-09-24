/** Placeholders the redact node writes in place of personal data (specs/design.md §8.1). */
const PLACEHOLDER = /\[(?:TOKEN|SECRET|EMAIL|PHONE|ID|USER)\]/g;

export interface TextPart {
  text: string;
  redacted: boolean;
}

/** Splits the redacted text so the view can mark each placeholder; the text is not changed. */
export function redactionParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index), redacted: false });
    }
    parts.push({ text: match[0], redacted: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), redacted: false });
  }
  return parts;
}

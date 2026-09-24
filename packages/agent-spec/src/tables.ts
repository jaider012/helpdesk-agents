export interface GfmTable {
  header: string[];
  rows: string[][];
}

/**
 * Returns the lines under the exact heading line `heading` (e.g. `## SLA`) up to the next heading of
 * the same or a higher level. Headings inside fenced code blocks do not count.
 */
export function findSection(markdown: string, heading: string): string | undefined {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return undefined;
  const level = /^#+/.exec(heading)?.[0].length ?? 0;
  const section: string[] = [];
  let inFence = false;
  for (const line of lines.slice(start + 1)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const nextHeading = /^(#+)\s/.exec(line);
    if (!inFence && nextHeading && nextHeading[1].length <= level) break;
    section.push(line);
  }
  return section.join('\n');
}

/** Reads the first GFM table of the section under `heading`, outside fenced code blocks. */
export function findTable(markdown: string, heading: string): GfmTable | undefined {
  const lines = findSection(markdown, heading)?.split('\n');
  if (!lines) return undefined;
  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*(```|~~~)/.test(lines[index])) inFence = !inFence;
    if (inFence || !isRow(lines[index])) continue;
    const block: string[] = [];
    for (let row = index; row < lines.length && isRow(lines[row]); row += 1) block.push(lines[row]);
    if (block.length < 2 || !splitRow(block[1]).every((cell) => /^:?-{3,}:?$/.test(cell))) {
      return undefined;
    }
    return { header: splitRow(block[0]), rows: block.slice(2).map(splitRow) };
  }
  return undefined;
}

function isRow(line: string): boolean {
  return line.trim().startsWith('|');
}

/** Splits a table row on unescaped `|`. */
function splitRow(line: string): string[] {
  const inner = line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

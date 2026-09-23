export interface GfmTable {
  header: string[];
  rows: string[][];
}

/**
 * Reads the first GFM table after the exact heading line `heading` (e.g. `## SLA`), before the
 * next heading of the same or a higher level. Fenced code blocks are skipped.
 */
export function findTable(markdown: string, heading: string): GfmTable | undefined {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return undefined;
  const level = /^#+/.exec(heading)?.[0].length ?? 0;
  let inFence = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const nextHeading = /^(#+)\s/.exec(line);
    if (nextHeading && nextHeading[1].length <= level) return undefined;
    if (!isRow(line)) continue;
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

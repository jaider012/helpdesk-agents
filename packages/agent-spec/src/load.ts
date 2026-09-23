import { readdir, readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { parseFrontmatter, type FrontmatterKind, type ParsedFrontmatter } from './frontmatter.js';

export type SpecFileKind = FrontmatterKind | 'copilot-instructions';

export interface SpecFile {
  kind: SpecFileKind;
  /** Path relative to the spec root, with `/` separators (e.g. `.github/agents/triage.agent.md`). */
  path: string;
  frontmatter: ParsedFrontmatter;
}

export interface SpecBundle {
  /** Folder that contains `.github/`. */
  root: string;
  /** Files sorted by `path`. */
  files: SpecFile[];
}

const KIND_PATTERNS: ReadonlyArray<[SpecFileKind, RegExp]> = [
  ['agent', /^\.github\/agents\/[^/]+\.agent\.md$/],
  ['skill', /^\.github\/skills\/[^/]+\/SKILL\.md$/],
  ['prompt', /^\.github\/prompts\/[^/]+\.prompt\.md$/],
  ['instructions', /^\.github\/instructions\/.+\.instructions\.md$/],
  ['copilot-instructions', /^\.github\/copilot-instructions\.md$/],
];

function kindOf(path: string): SpecFileKind | undefined {
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(path))?.[0];
}

/** Reads every customization file under `<root>/.github/` and parses its frontmatter. */
export async function loadSpec(root: string): Promise<SpecBundle> {
  const entries = await readdir(join(root, '.github'), { recursive: true });
  const paths = entries.map((entry) => ['.github', ...entry.split(sep)].join('/')).sort();
  const files: SpecFile[] = [];
  for (const path of paths) {
    const kind = kindOf(path);
    if (!kind) continue;
    const raw = await readFile(join(root, path), 'utf8');
    files.push({ kind, path, frontmatter: parseFrontmatter(raw) });
  }
  return { root, files };
}

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { parseFrontmatter, type FrontmatterKind, type ParsedFrontmatter } from './frontmatter.ts';

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
  /** Every file under `.github/`, relative to `root` and sorted, whatever its type. */
  paths: string[];
  /** Customization files, sorted by `path`. */
  files: SpecFile[];
  /** Contents of the skill resources (`.github/skills/<name>/scripts/**`), by path. */
  resources: Record<string, string>;
}

const KIND_PATTERNS: ReadonlyArray<[SpecFileKind, RegExp]> = [
  ['agent', /^\.github\/agents\/[^/]+\.agent\.md$/],
  ['skill', /^\.github\/skills\/[^/]+\/SKILL\.md$/],
  ['prompt', /^\.github\/prompts\/[^/]+\.prompt\.md$/],
  ['instructions', /^\.github\/instructions\/.+\.instructions\.md$/],
  ['copilot-instructions', /^\.github\/copilot-instructions\.md$/],
];

const SKILL_RESOURCE = /^\.github\/skills\/[^/]+\/scripts\/.+/;

function kindOf(path: string): SpecFileKind | undefined {
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(path))?.[0];
}

async function listGithubFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(join(root, '.github'), { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
      .sort();
  } catch (error) {
    // A missing `.github/` is a spec error (REQUIRED_FILE_MISSING), not a crash.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Reads every customization file under `<root>/.github/` and parses its frontmatter. */
export async function loadSpec(root: string): Promise<SpecBundle> {
  const paths = await listGithubFiles(root);
  const files: SpecFile[] = [];
  for (const path of paths) {
    const kind = kindOf(path);
    if (!kind) continue;
    const raw = await readFile(join(root, path), 'utf8');
    files.push({ kind, path, frontmatter: parseFrontmatter(raw) });
  }
  const resources: Record<string, string> = {};
  for (const path of paths.filter((candidate) => SKILL_RESOURCE.test(candidate))) {
    resources[path] = await readFile(join(root, path), 'utf8');
  }
  return { root, paths, files, resources };
}

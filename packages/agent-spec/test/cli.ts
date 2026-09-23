import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

/** Runs `pnpm spec:validate` as the CLI does, against the spec rooted at `root`. */
export function runCli(root: string): { code: number | null; stdout: string } {
  const run = spawnSync(process.execPath, [CLI, '--root', root], { encoding: 'utf8' });
  return { code: run.status, stdout: run.stdout };
}

export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, the folder that contains `.github/` and `data/` (same depth from `src/` and `dist/`). */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Data folder: `DATA_DIR` resolved against the repository root, `data/` by default, so the api and
 * Copilot mode share the same tickets and audit log (design §12.4, §12.5).
 */
export function resolveDataDir(env: Record<string, string | undefined>): string {
  return resolve(REPO_ROOT, env.DATA_DIR || 'data');
}

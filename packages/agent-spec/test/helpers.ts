import { fileURLToPath } from 'node:url';
import { loadSpec, validateSpec, type ErrorCode, type ValidationError } from '../src/index.ts';

/** Absolute path of a fixture root, the folder that contains its `.github/`. */
export function fixture(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** Validation errors of one code for a spec root (a fixture name or an absolute path). */
export async function errorsWithCode(root: string, code: ErrorCode): Promise<ValidationError[]> {
  const errors = validateSpec(await loadSpec(root.startsWith('/') ? root : fixture(root)));
  return errors.filter((error) => error.code === code);
}

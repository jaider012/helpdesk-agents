import { unknownKeys } from './frontmatter.js';
import type { SpecBundle, SpecFile } from './load.js';

export type ErrorCode = 'FRONTMATTER_PARSE_ERROR' | 'UNKNOWN_FRONTMATTER_KEY';

export interface ValidationError {
  code: ErrorCode;
  /** Offending file, relative to the spec root. */
  path: string;
  message: string;
}

export function validateSpec(bundle: SpecBundle): ValidationError[] {
  return bundle.files.flatMap(validateFrontmatter);
}

function validateFrontmatter(file: SpecFile): ValidationError[] {
  if (!file.frontmatter.ok) {
    return [{ code: 'FRONTMATTER_PARSE_ERROR', path: file.path, message: file.frontmatter.error }];
  }
  // copilot-instructions.md has no frontmatter keys in Annex A.
  if (file.kind === 'copilot-instructions') return [];
  return unknownKeys(file.kind, file.frontmatter.data).map((key) => ({
    code: 'UNKNOWN_FRONTMATTER_KEY',
    path: file.path,
    message: `unknown frontmatter key \`${key}\``,
  }));
}

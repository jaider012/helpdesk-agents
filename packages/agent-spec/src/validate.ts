import { unknownKeys } from './frontmatter.ts';
import type { SpecBundle, SpecFile } from './load.ts';

export type ErrorCode =
  'REQUIRED_FILE_MISSING' | 'FRONTMATTER_PARSE_ERROR' | 'UNKNOWN_FRONTMATTER_KEY';

/** Annex D of requirements.md. */
export const REQUIRED_FILES = [
  '.github/agents/diagnostics.agent.md',
  '.github/agents/escalation.agent.md',
  '.github/agents/provisioning.agent.md',
  '.github/agents/triage.agent.md',
  '.github/copilot-instructions.md',
  '.github/instructions/ticket-lifecycle.instructions.md',
  '.github/prompts/escalate-ticket.prompt.md',
  '.github/prompts/run-vpn-diagnostics.prompt.md',
  '.github/prompts/triage-ticket.prompt.md',
  '.github/skills/vpn-diagnostics/SKILL.md',
  '.github/skills/vpn-diagnostics/scripts/check-vpn.js',
] as const;

export interface ValidationError {
  code: ErrorCode;
  /** Offending file, relative to the spec root. */
  path: string;
  message: string;
}

export function validateSpec(bundle: SpecBundle): ValidationError[] {
  return [...validateRequiredFiles(bundle), ...bundle.files.flatMap(validateFrontmatter)];
}

/** One line per error, as `pnpm spec:validate` prints it. */
export function formatError(error: ValidationError): string {
  return `${error.code} ${error.path}: ${error.message}`;
}

function validateRequiredFiles(bundle: SpecBundle): ValidationError[] {
  return REQUIRED_FILES.filter((path) => !bundle.paths.includes(path)).map((path) => ({
    code: 'REQUIRED_FILE_MISSING',
    path,
    message: 'required file is missing',
  }));
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

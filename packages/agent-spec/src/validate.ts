import { agentIssues } from './agents.ts';
import { unknownKeys } from './frontmatter.ts';
import { buildHandoffGraph, graphIssues } from './graph.ts';
import { LIFECYCLE_PATH, lifecycleIssues } from './lifecycle.ts';
import type { SpecBundle, SpecFile } from './load.ts';
import { promptIssues } from './prompts.ts';
import { routeHandoffIssues, routingDeterminismIssues } from './routing-check.ts';
import { ROUTE_INPUT_DOMAINS, ROUTING_RULES } from './routing.ts';
import { skillBodyIssues, skillFrontmatterIssues } from './skill.ts';

export type ErrorCode =
  | 'REQUIRED_FILE_MISSING'
  | 'FRONTMATTER_PARSE_ERROR'
  | 'UNKNOWN_FRONTMATTER_KEY'
  | 'LIFECYCLE_APPLYTO_MISSING'
  | 'LIFECYCLE_TABLE_INVALID'
  | 'UNKNOWN_STATUS'
  | 'SKILL_FRONTMATTER_INVALID'
  | 'SKILL_NAME_MISMATCH'
  | 'SKILL_DESCRIPTION_TOO_LONG'
  | 'SKILL_ACTIVATION_MISSING'
  | 'SKILL_STEPS_MISSING'
  | 'SKILL_RESOURCE_UNLINKED'
  | 'SKILL_FAILURE_SECTION_MISSING'
  | 'SKILL_DEADLINE_INVALID'
  | 'AGENT_FRONTMATTER_INVALID'
  | 'HANDOFF_INVALID'
  | 'AGENT_VISIBILITY_INVALID'
  | 'HANDOFF_NOT_ALLOWED'
  | 'TOOL_NOT_PERMITTED'
  | 'UNKNOWN_TOOL'
  | 'HANDOFF_CYCLE'
  | 'TERMINAL_HAS_HANDOFFS'
  | 'SELF_HANDOFF'
  | 'UNKNOWN_HANDOFF_TARGET'
  | 'HANDOFF_CONTEXT_EXCEEDED'
  | 'UNSAFE_ALLOWLIST_ACTION'
  | 'ROUTE_WITHOUT_HANDOFF'
  | 'ROUTING_NOT_DETERMINISTIC'
  | 'PROMPT_FRONTMATTER_INVALID'
  | 'UNKNOWN_PROMPT_AGENT'
  | 'PROMPT_VARIABLE_MISSING'
  | 'PROMPT_WITHOUT_TOOL_CALL'
  | 'PROMPT_TOOL_UNDECLARED'
  | 'PII_IN_FIXTURE';

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
  return [
    ...validateRequiredFiles(bundle),
    ...bundle.files.flatMap(validateFrontmatter),
    ...validateLifecycle(bundle),
    ...bundle.files.flatMap((file) => validateSkill(file, bundle.resources)),
    ...bundle.files
      .filter((file) => file.kind === 'agent')
      .flatMap((file) => agentIssues(file).map((issue) => ({ ...issue, path: file.path }))),
    ...graphIssues(bundle),
    ...routeHandoffIssues(buildHandoffGraph(bundle), ROUTING_RULES),
    ...routingDeterminismIssues(ROUTING_RULES, ROUTE_INPUT_DOMAINS),
    ...validatePrompts(bundle),
  ];
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

function validateLifecycle(bundle: SpecBundle): ValidationError[] {
  const file = bundle.files.find(({ path }) => path === LIFECYCLE_PATH);
  // A missing file or a broken frontmatter is already reported by the rules above.
  if (!file?.frontmatter.ok) return [];
  return lifecycleIssues(file.frontmatter.data, file.frontmatter.body).map((issue) => ({
    ...issue,
    path: LIFECYCLE_PATH,
  }));
}

function validateSkill(file: SpecFile, resources: Record<string, string>): ValidationError[] {
  if (file.kind !== 'skill' || !file.frontmatter.ok) return [];
  return [
    ...skillFrontmatterIssues(file.path, file.frontmatter.data),
    ...skillBodyIssues(file.path, file.frontmatter.body, resources),
  ].map((issue) => ({ ...issue, path: file.path }));
}

function validatePrompts(bundle: SpecBundle): ValidationError[] {
  const agentNames = new Set(buildHandoffGraph(bundle).agents.keys());
  return bundle.files
    .filter((file) => file.kind === 'prompt')
    .flatMap((file) =>
      promptIssues(file, agentNames).map((issue) => ({ ...issue, path: file.path })),
    );
}

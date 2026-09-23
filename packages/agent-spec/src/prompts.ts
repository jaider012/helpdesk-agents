import { z } from 'zod';
import type { SpecFile } from './load.ts';

export interface PromptIssue {
  code:
    | 'PROMPT_FRONTMATTER_INVALID'
    | 'UNKNOWN_PROMPT_AGENT'
    | 'PROMPT_VARIABLE_MISSING'
    | 'PROMPT_WITHOUT_TOOL_CALL'
    | 'PROMPT_TOOL_UNDECLARED';
  message: string;
}

/** Variables each operator prompt must declare (REQ-2.4-03..05), by prompt name. */
export const REQUIRED_PROMPT_VARIABLES: Readonly<Record<string, readonly string[]>> = {
  'triage-ticket': ['ticket', 'channel'],
  'run-vpn-diagnostics': ['ticketId', 'target'],
  'escalate-ticket': ['ticketId', 'reason'],
};

export interface PromptVariable {
  name: string;
  placeholder?: string;
}

// `${input:name}` or `${input:name:placeholder}`; the placeholder may contain `:`.
const VARIABLE = /\$\{input:([A-Za-z_][\w-]*)(?::([^}]*))?\}/g;
// `#tool:read/readFile`; a trailing `.` or `,` ends the name.
const TOOL_REFERENCE = /#tool:([\w-]+(?:\/[\w-]+)*)/g;

/** Prompt id: `name`, or the file name without `.prompt.md` (VS Code default). */
export function promptName(file: SpecFile): string {
  const name = file.frontmatter.ok ? file.frontmatter.data.name : undefined;
  return typeof name === 'string' && name.length > 0
    ? name
    : (file.path.split('/').at(-1) ?? '').replace(/\.prompt\.md$/, '');
}

/** `${input:*}` variables of a prompt body, once each, in order of appearance. */
export function promptVariables(body: string): PromptVariable[] {
  const variables = new Map<string, PromptVariable>();
  for (const [, name, placeholder] of body.matchAll(VARIABLE)) {
    if (!variables.has(name)) {
      variables.set(name, placeholder === undefined ? { name } : { name, placeholder });
    }
  }
  return [...variables.values()];
}

/** `#tool:<name>` references of a prompt body, once each. */
export function promptToolReferences(body: string): string[] {
  return [...new Set([...body.matchAll(TOOL_REFERENCE)].map(([, name]) => name))];
}

const text = z.string().min(1);
const toolList = z.array(text);

/** Frontmatter, agent, variables and tool references of one `.prompt.md` (REQ-2.4-01..07). */
export function promptIssues(file: SpecFile, agentNames: ReadonlySet<string>): PromptIssue[] {
  if (!file.frontmatter.ok) return [];
  const { data, body } = file.frontmatter;
  const issues: PromptIssue[] = [];

  const agent = text.safeParse(data.agent);
  if (!agent.success) {
    issues.push({
      code: 'PROMPT_FRONTMATTER_INVALID',
      message: '`agent` must be a non-empty text',
    });
  }
  const tools = toolList.safeParse(data.tools);
  if (!tools.success) {
    issues.push({
      code: 'PROMPT_FRONTMATTER_INVALID',
      message: '`tools` must be a list of tool names',
    });
  }
  if (agent.success && !agentNames.has(agent.data)) {
    issues.push({
      code: 'UNKNOWN_PROMPT_AGENT',
      message: `agent \`${agent.data}\` has no .agent.md file`,
    });
  }

  const declared = new Set(promptVariables(body).map(({ name }) => name));
  for (const name of REQUIRED_PROMPT_VARIABLES[promptName(file)] ?? []) {
    if (!declared.has(name)) {
      issues.push({
        code: 'PROMPT_VARIABLE_MISSING',
        message: `the body lacks the variable \`\${input:${name}}\``,
      });
    }
  }

  const references = promptToolReferences(body);
  if (references.length === 0) {
    issues.push({
      code: 'PROMPT_WITHOUT_TOOL_CALL',
      message: 'the body has no `#tool:<name>` reference',
    });
  }
  // Without a valid `tools` list, every reference would look undeclared; that is reported above.
  if (tools.success) {
    for (const reference of references.filter((name) => !tools.data.includes(name))) {
      issues.push({
        code: 'PROMPT_TOOL_UNDECLARED',
        message: `\`#tool:${reference}\` is not in the \`tools\` of the prompt`,
      });
    }
  }
  return issues;
}

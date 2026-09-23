import { z } from 'zod';
import type { SpecFile } from './load.ts';
import { AGENT_POLICY, isAgentName, REGISTRY_TOOLS } from './policy.ts';

export interface AgentIssue {
  code:
    | 'AGENT_FRONTMATTER_INVALID'
    | 'HANDOFF_INVALID'
    | 'AGENT_VISIBILITY_INVALID'
    | 'HANDOFF_NOT_ALLOWED'
    | 'TOOL_NOT_PERMITTED'
    | 'UNKNOWN_TOOL';
  message: string;
}

const text = z.string().min(1);
const flag = z.boolean();
const TEXT = 'must be a non-empty text';
const FLAG = 'must be true or false';

// [key, schema, required, message] in the order the errors are reported.
const AGENT_FIELDS: ReadonlyArray<[string, z.ZodType, boolean, string]> = [
  ['description', text, true, TEXT],
  ['name', text, false, TEXT],
  ['tools', z.array(text), true, 'must be a list of tool names'],
  ['user-invocable', flag, false, FLAG],
  ['disable-model-invocation', flag, false, FLAG],
  ['handoffs', z.array(z.unknown()), false, 'must be a list'],
];
const HANDOFF_FIELDS: ReadonlyArray<[string, z.ZodType, string]> = [
  ['label', text, TEXT],
  ['agent', text, TEXT],
  ['prompt', text, TEXT],
  ['send', flag, FLAG],
];

/** Agent id: `name`, or the file name without `.agent.md` (VS Code default). */
export function agentName(file: SpecFile): string {
  const name = file.frontmatter.ok ? file.frontmatter.data.name : undefined;
  return typeof name === 'string' && name.length > 0
    ? name
    : (file.path.split('/').at(-1) ?? '').replace(/\.agent\.md$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Frontmatter shape, handoff fields and visibility of one `.agent.md` (REQ-2.3-01, 02, 08). */
export function agentIssues(file: SpecFile): AgentIssue[] {
  if (!file.frontmatter.ok) return [];
  const data = file.frontmatter.data;
  const issues: AgentIssue[] = [];

  for (const [key, schema, required, message] of AGENT_FIELDS) {
    const value = data[key];
    if ((value !== undefined || required) && !schema.safeParse(value).success) {
      issues.push({ code: 'AGENT_FRONTMATTER_INVALID', message: `\`${key}\` ${message}` });
    }
  }

  const handoffs = Array.isArray(data.handoffs) ? data.handoffs : [];
  handoffs.forEach((handoff, index) => {
    if (!isRecord(handoff)) {
      issues.push({
        code: 'HANDOFF_INVALID',
        message: `\`handoffs[${index}]\` must be a mapping with \`label\`, \`agent\`, \`prompt\` and \`send\``,
      });
      return;
    }
    for (const [key, schema, message] of HANDOFF_FIELDS) {
      if (!schema.safeParse(handoff[key]).success) {
        issues.push({
          code: 'HANDOFF_INVALID',
          message: `\`handoffs[${index}].${key}\` ${message}`,
        });
      }
    }
  });

  const tools = Array.isArray(data.tools)
    ? data.tools.filter((tool): tool is string => typeof tool === 'string')
    : [];
  const registry: readonly string[] = REGISTRY_TOOLS;
  for (const tool of tools.filter((candidate) => !registry.includes(candidate))) {
    issues.push({ code: 'UNKNOWN_TOOL', message: `tool \`${tool}\` is not in the tool registry` });
  }

  const name = agentName(file);
  if (!isAgentName(name)) {
    issues.push({
      code: 'AGENT_VISIBILITY_INVALID',
      message: `agent \`${name}\` is not in policy.ts`,
    });
    return issues;
  }
  const policy = AGENT_POLICY[name];
  const visibility: ReadonlyArray<[string, boolean, boolean]> = [
    ['user-invocable', true, policy.userInvocable],
    ['disable-model-invocation', false, policy.disableModelInvocation],
  ];
  for (const [key, fallback, expected] of visibility) {
    const value = data[key] ?? fallback;
    // A value of the wrong type is reported as AGENT_FRONTMATTER_INVALID above.
    if (typeof value === 'boolean' && value !== expected) {
      issues.push({
        code: 'AGENT_VISIBILITY_INVALID',
        message: `\`${key}\` is ${value} but policy.ts requires ${expected}`,
      });
    }
  }

  const allowedHandoffs: readonly string[] = policy.handoffs;
  const targets = handoffs.filter(isRecord).map((handoff) => handoff.agent);
  for (const target of targets.filter((agent): agent is string => typeof agent === 'string')) {
    if (!allowedHandoffs.includes(target)) {
      issues.push({
        code: 'HANDOFF_NOT_ALLOWED',
        message: `policy.ts does not allow the handoff \`${name}\` → \`${target}\``,
      });
    }
  }

  const permittedTools: readonly string[] = policy.tools;
  for (const tool of tools.filter((candidate) => registry.includes(candidate))) {
    if (!permittedTools.includes(tool)) {
      issues.push({
        code: 'TOOL_NOT_PERMITTED',
        message: `policy.ts does not permit the tool \`${tool}\` for \`${name}\``,
      });
    }
  }
  return issues;
}

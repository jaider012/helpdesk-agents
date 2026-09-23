// Normative source of what each agent may declare (design §5.2, requirements Annex B, decision
// D-12). The .agent.md files declare; this file bounds what they can declare. Changing it needs
// the approval of the project owner.

export const AGENT_NAMES = ['triage', 'diagnostics', 'provisioning', 'escalation'] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

/** Tool names of the runtime registry (design §10.1), as VS Code qualifies them. */
export const REGISTRY_TOOLS = [
  'read/readFile',
  'edit/createFile',
  'edit/editFiles',
  'execute/runInTerminal',
] as const;
export type ToolName = (typeof REGISTRY_TOOLS)[number];

export interface AgentPolicy {
  userInvocable: boolean;
  disableModelInvocation: boolean;
  handoffs: readonly AgentName[];
  tools: readonly ToolName[];
}

export const AGENT_POLICY: Record<AgentName, AgentPolicy> = {
  triage: {
    userInvocable: true,
    disableModelInvocation: false,
    handoffs: ['diagnostics', 'provisioning', 'escalation'],
    tools: ['read/readFile', 'edit/createFile', 'edit/editFiles'],
  },
  diagnostics: {
    userInvocable: true,
    disableModelInvocation: true,
    handoffs: ['escalation'],
    tools: ['read/readFile', 'edit/editFiles', 'execute/runInTerminal'],
  },
  provisioning: {
    userInvocable: true,
    disableModelInvocation: true,
    handoffs: ['escalation'],
    tools: ['read/readFile', 'edit/editFiles'],
  },
  escalation: {
    userInvocable: true,
    disableModelInvocation: true,
    handoffs: [],
    tools: ['read/readFile', 'edit/editFiles'],
  },
};

/** The only ticket fields a handoff may carry (REQ-2.3-11, REQ-2.3-17). */
export const HANDOFF_CONTEXT_FIELDS = [
  'ticketId',
  'category',
  'severity',
  'entities',
  'findings',
] as const;

/** Tags that no remediation allowlist action may carry (REQ-2.3-33). */
export const FORBIDDEN_ALLOWLIST_TAGS = ['mfa', 'credentials', 'permissions'] as const;

export function isAgentName(value: string): value is AgentName {
  return (AGENT_NAMES as readonly string[]).includes(value);
}

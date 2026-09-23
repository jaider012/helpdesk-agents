import type { ToolName } from 'agent-spec';

export interface ToolDescriptor {
  name: ToolName;
  /** `implicit`: the runtime runs it for the node; `invocable`: the node procedure calls it. */
  kind: 'implicit' | 'invocable';
  /** What implements it in the runtime (design §10.1). */
  implementation: string;
}

/** Tool registry: every name that `policy.ts` allows, and only those (design §10.1). */
export const TOOL_REGISTRY: Record<ToolName, ToolDescriptor> = {
  'read/readFile': {
    name: 'read/readFile',
    kind: 'implicit',
    implementation: 'TicketStore.read, limited to the current ticket',
  },
  'edit/createFile': {
    name: 'edit/createFile',
    kind: 'implicit',
    implementation: 'TicketStore.save',
  },
  'edit/editFiles': {
    name: 'edit/editFiles',
    kind: 'implicit',
    implementation: 'TicketStore.save + AuditLog.append',
  },
  'execute/runInTerminal': {
    name: 'execute/runInTerminal',
    kind: 'invocable',
    implementation: 'skill runner: only the scripts of registered skills',
  },
};

export function resolveTool(name: string): ToolDescriptor | undefined {
  return Object.hasOwn(TOOL_REGISTRY, name) ? TOOL_REGISTRY[name as ToolName] : undefined;
}

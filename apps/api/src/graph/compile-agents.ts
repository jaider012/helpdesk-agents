import {
  agentName,
  buildHandoffGraph,
  isAgentName,
  type AgentName,
  type HandoffEdge,
  type SpecBundle,
} from 'agent-spec';
import { resolveTool, type ToolDescriptor } from '../tools/registry.js';

export interface CompiledAgent {
  name: AgentName;
  description: string;
  /** Body of the `.agent.md` file (REQ-2.3-13). */
  systemPrompt: string;
  tools: ToolDescriptor[];
  handoffs: HandoffEdge[];
}

/** One compiled agent per `.agent.md` file; an unknown tool aborts the startup (design §10). */
export function compileAgents(bundle: SpecBundle): CompiledAgent[] {
  const { edges } = buildHandoffGraph(bundle);
  return bundle.files
    .filter((file) => file.kind === 'agent')
    .map((file) => {
      if (!file.frontmatter.ok) throw new Error(`${file.path} has an invalid frontmatter`);
      const name = agentName(file);
      if (!isAgentName(name)) throw new Error(`agent \`${name}\` is not in policy.ts`);
      const { data, body } = file.frontmatter;
      const declared = Array.isArray(data.tools) ? data.tools.map(String) : [];
      const tools = declared.map((tool) => {
        const descriptor = resolveTool(tool);
        if (!descriptor) throw new Error(`agent \`${name}\` declares the unknown tool \`${tool}\``);
        return descriptor;
      });
      return {
        name,
        description: String(data.description ?? ''),
        systemPrompt: body,
        tools,
        handoffs: edges.filter(({ from }) => from === name),
      };
    });
}

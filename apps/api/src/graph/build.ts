import { END, START, StateGraph } from '@langchain/langgraph';
import { ROUTING_RULES, type AgentName, type SpecBundle } from 'agent-spec';
import type { CompiledAgent } from './compile-agents.js';
import { TicketGraphState, type GraphState, type GraphUpdate } from './state.js';

export type GraphNodeName = AgentName | 'redact';
export type GraphNode = (state: GraphState) => GraphUpdate | Promise<GraphUpdate>;
export type GraphNodes = Record<GraphNodeName, GraphNode>;

/** Entry agents: `triage` for new tickets and the `agent` of each prompt file (design §2). */
function entryAgents(bundle: SpecBundle, agents: readonly CompiledAgent[]): AgentName[] {
  const named = new Set<string>(['triage']);
  for (const file of bundle.files) {
    if (file.kind === 'prompt' && file.frontmatter.ok)
      named.add(String(file.frontmatter.data.agent));
  }
  return agents.map(({ name }) => name).filter((name) => named.has(name));
}

/** Whether the agent may end the run: a routing rule to END, or a terminal agent without rules. */
function canEnd(agent: AgentName): boolean {
  const rules = (ROUTING_RULES as Partial<Record<AgentName, ReadonlyArray<{ to: string }>>>)[agent];
  return rules ? rules.some(({ to }) => to === 'END') : true;
}

/** The target chosen by the last routing decision of the node that just ran. */
function routeTarget(state: GraphState): string {
  const to = state.lastRoute?.to;
  return !to || to === 'END' ? END : to;
}

/**
 * Compiles the LangGraph graph (REQ-2.3-12..14): the redact node, one node per `.agent.md` file
 * with its body as system prompt, and one conditional edge per declared handoff.
 */
export function buildGraph(
  bundle: SpecBundle,
  agents: readonly CompiledAgent[],
  nodes: GraphNodes,
) {
  // Node names come from the spec at runtime, so the builder is typed with plain strings.
  const graph = new StateGraph(TicketGraphState) as unknown as StateGraph<
    typeof TicketGraphState.spec,
    GraphState,
    GraphUpdate,
    string
  >;
  graph.addNode('redact', nodes.redact);
  for (const agent of agents) {
    graph.addNode(agent.name, nodes[agent.name], {
      metadata: {
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        tools: agent.tools.map(({ name }) => name),
      },
    });
  }
  graph.addEdge(START, 'redact');
  graph.addConditionalEdges(
    'redact',
    (state: GraphState) => state.entryAgent,
    entryAgents(bundle, agents),
  );
  for (const agent of agents) {
    const targets: string[] = agent.handoffs.map(({ to }) => to);
    graph.addConditionalEdges(
      agent.name,
      routeTarget,
      canEnd(agent.name) ? [...targets, END] : targets,
    );
  }
  return graph.compile();
}

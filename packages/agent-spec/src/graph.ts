import { agentName, isRecord } from './agents.ts';
import type { SpecBundle } from './load.ts';
import { AGENT_POLICY, AGENT_NAMES } from './policy.ts';

export interface HandoffEdge {
  from: string;
  to: string;
  label: string;
  prompt: string;
  send: boolean;
  /** `.agent.md` that declares the handoff. */
  path: string;
}

export interface HandoffGraph {
  /** Agent name → path of its `.agent.md`. */
  agents: Map<string, string>;
  edges: HandoffEdge[];
}

export interface GraphIssue {
  code: 'HANDOFF_CYCLE' | 'TERMINAL_HAS_HANDOFFS' | 'SELF_HANDOFF' | 'UNKNOWN_HANDOFF_TARGET';
  path: string;
  message: string;
}

/** Terminal agents: the ones that policy.ts allows no handoff (`escalation`). */
const TERMINAL_AGENTS: readonly string[] = AGENT_NAMES.filter(
  (name) => AGENT_POLICY[name].handoffs.length === 0,
);

/** One node per `.agent.md` and one edge per declared handoff with a text `agent`. */
export function buildHandoffGraph(bundle: SpecBundle): HandoffGraph {
  const agents = new Map<string, string>();
  const edges: HandoffEdge[] = [];
  for (const file of bundle.files) {
    if (file.kind !== 'agent' || !file.frontmatter.ok) continue;
    const from = agentName(file);
    agents.set(from, file.path);
    const { handoffs } = file.frontmatter.data;
    for (const handoff of Array.isArray(handoffs) ? handoffs.filter(isRecord) : []) {
      if (typeof handoff.agent !== 'string' || handoff.agent.length === 0) continue;
      edges.push({
        from,
        to: handoff.agent,
        label: typeof handoff.label === 'string' ? handoff.label : '',
        prompt: typeof handoff.prompt === 'string' ? handoff.prompt : '',
        send: handoff.send === true,
        path: file.path,
      });
    }
  }
  return { agents, edges };
}

/** Elementary cycles, each rotated to start at its smallest agent name and reported once. */
function findCycles(graph: HandoffGraph): string[][] {
  const next = new Map<string, string[]>();
  for (const { from, to } of graph.edges) {
    if (from !== to && graph.agents.has(to)) next.set(from, [...(next.get(from) ?? []), to]);
  }
  const cycles = new Map<string, string[]>();
  const visit = (node: string, stack: string[]) => {
    for (const target of next.get(node) ?? []) {
      const index = stack.indexOf(target);
      if (index !== -1) {
        const cycle = stack.slice(index);
        const start = cycle.indexOf([...cycle].sort()[0]);
        const rotated = [...cycle.slice(start), ...cycle.slice(0, start)];
        cycles.set(rotated.join('→'), rotated);
      } else {
        visit(target, [...stack, target]);
      }
    }
  };
  for (const node of [...graph.agents.keys()].sort()) visit(node, [node]);
  return [...cycles.values()];
}

/** Shape of the handoff graph (REQ-2.3-03..06). */
export function graphIssues(bundle: SpecBundle): GraphIssue[] {
  const graph = buildHandoffGraph(bundle);
  const issues: GraphIssue[] = [];
  for (const { from, to, path } of graph.edges) {
    if (from === to) {
      issues.push({ code: 'SELF_HANDOFF', path, message: `\`${from}\` hands off to itself` });
    } else if (!graph.agents.has(to)) {
      issues.push({
        code: 'UNKNOWN_HANDOFF_TARGET',
        path,
        message: `handoff target \`${to}\` has no .agent.md file`,
      });
    }
  }
  for (const [name, path] of graph.agents) {
    const count = graph.edges.filter(({ from }) => from === name).length;
    if (TERMINAL_AGENTS.includes(name) && count > 0) {
      issues.push({
        code: 'TERMINAL_HAS_HANDOFFS',
        path,
        message: `the terminal agent \`${name}\` declares ${count} ${count === 1 ? 'handoff' : 'handoffs'}`,
      });
    }
  }
  for (const cycle of findCycles(graph)) {
    issues.push({
      code: 'HANDOFF_CYCLE',
      path: graph.agents.get(cycle[0]) ?? '',
      message: `handoff cycle ${[...cycle, cycle[0]].map((name) => `\`${name}\``).join(' → ')}`,
    });
  }
  return issues;
}

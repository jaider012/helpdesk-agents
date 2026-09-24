import { buildHandoffGraph } from './graph.ts';
import type { SpecBundle } from './load.ts';
import { AGENT_NAMES } from './policy.ts';
import { promptName } from './prompts.ts';
import { ROUTING_RULES, type RouteRule } from './routing.ts';

const START_MARKER = '<!-- SPEC:GRAPH:START -->';
const END_MARKER = '<!-- SPEC:GRAPH:END -->';

/** A Mermaid edge label: double quotes would close it. */
function label(text: string): string {
  return `"${text.replace(/"/g, '#quot;')}"`;
}

/** The ids of the routing rules from `from` to `to`, in `routing.ts` order. */
function ruleIds(from: string, to: string): string[] {
  const rules = (ROUTING_RULES as Partial<Record<string, ReadonlyArray<RouteRule<unknown>>>>)[from];
  return (rules ?? []).filter((rule) => rule.to === to).map(({ id }) => id);
}

/**
 * The compiled handoff graph as a Mermaid flowchart (REQ-DOC-01): the redact node enters `triage`
 * for new tickets and the `agent` of each prompt file; one edge per declared handoff, labelled with
 * its `label` and the routing rules that take it; and the end of the run, from the routing rules to
 * END and from the agents without handoffs. Agents follow the order of `policy.ts`.
 */
export function handoffGraphMermaid(bundle: SpecBundle): string {
  const graph = buildHandoffGraph(bundle);
  const order = (name: string) => {
    const index = (AGENT_NAMES as readonly string[]).indexOf(name);
    return index === -1 ? AGENT_NAMES.length : index;
  };
  const agents = [...graph.agents.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));

  const entries = new Map<string, string[]>([['triage', ['ticket nuevo']]]);
  for (const file of bundle.files) {
    if (file.kind !== 'prompt' || !file.frontmatter.ok) continue;
    const agent = String(file.frontmatter.data.agent);
    entries.set(agent, [...(entries.get(agent) ?? []), `/${promptName(file)}`]);
  }

  const lines = ['flowchart TD', '  START((inicio))', '  redact[redact node]', '  FIN((fin))'];
  lines.push('  START --> redact');
  for (const agent of agents) {
    const names = entries.get(agent);
    if (names) lines.push(`  redact -->|${label(names.join(' · '))}| ${agent}`);
  }
  for (const agent of agents) {
    const edges = graph.edges.filter(({ from }) => from === agent);
    for (const { from, to, label: text } of edges) {
      const rules = ruleIds(from, to);
      lines.push(
        `  ${from} -->|${label([text, rules.join(', ')].filter(Boolean).join(' · '))}| ${to}`,
      );
    }
    const ends = ruleIds(agent, 'END');
    if (ends.length > 0) lines.push(`  ${agent} -->|${label(ends.join(', '))}| FIN`);
    else if (edges.length === 0 && !(agent in ROUTING_RULES)) lines.push(`  ${agent} --> FIN`);
  }
  return `${lines.join('\n')}\n`;
}

/** Puts `mermaid` as the fenced block between the SPEC:GRAPH markers of the README. */
export function replaceReadmeGraph(readme: string, mermaid: string): string {
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);
  if (start === -1 || end < start) {
    throw new Error(`README.md has no ${START_MARKER} … ${END_MARKER} block`);
  }
  const block = `${START_MARKER}\n\`\`\`mermaid\n${mermaid}\`\`\`\n`;
  return readme.slice(0, start) + block + readme.slice(end);
}

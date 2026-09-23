import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { REGISTRY_TOOLS, loadSpec } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import { compileAgents } from '../src/graph/compile-agents.js';
import { GRAPH, GraphModule } from '../src/graph/graph.module.js';
import { SpecModule } from '../src/spec/spec.module.js';
import { TOOL_REGISTRY } from '../src/tools/registry.js';
import { realGraph } from './graph-helpers.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

const AGENTS = ['diagnostics', 'escalation', 'provisioning', 'triage'];

async function structure(graph: Awaited<ReturnType<typeof realGraph>>) {
  const drawable = await graph.getGraphAsync();
  return {
    nodes: Object.keys(drawable.nodes).sort(),
    edges: drawable.edges.map(({ source, target }) => `${source} → ${target}`).sort(),
  };
}

describe('graph.compile', () => {
  it('creates the redact node and one node per .agent.md file', async () => {
    expect((await structure(await realGraph())).nodes).toEqual(
      ['__end__', '__start__', 'redact', ...AGENTS].sort(),
    );
  });

  it('creates one agent-to-agent edge per declared handoff, plus the entry and end edges', async () => {
    const { edges } = await structure(await realGraph());
    const between = edges.filter((edge) => AGENTS.some((agent) => edge.startsWith(`${agent} → `)));

    expect(between.filter((edge) => !edge.endsWith('__end__'))).toEqual([
      'diagnostics → escalation',
      'provisioning → escalation',
      'triage → diagnostics',
      'triage → escalation',
      'triage → provisioning',
    ]);
    expect(between.filter((edge) => edge.endsWith('__end__'))).toEqual([
      'diagnostics → __end__',
      'escalation → __end__',
    ]);
    expect(edges.filter((edge) => edge.startsWith('redact → '))).toEqual([
      'redact → diagnostics',
      'redact → escalation',
      'redact → triage',
    ]);
    expect(edges).toContain('__start__ → redact');
  });

  it('resolves every agent tool from a registry that implements exactly the tools of policy.ts', async () => {
    expect(Object.keys(TOOL_REGISTRY).sort()).toEqual([...REGISTRY_TOOLS].sort());
    const agents = compileAgents(await loadSpec(REPO_ROOT));

    expect(
      Object.fromEntries(
        agents.map(({ name, tools }) => [name, tools.map(({ name: tool }) => tool)]),
      ),
    ).toEqual({
      diagnostics: ['read/readFile', 'edit/editFiles', 'execute/runInTerminal'],
      escalation: ['read/readFile', 'edit/editFiles'],
      provisioning: ['read/readFile', 'edit/editFiles'],
      triage: ['read/readFile', 'edit/createFile', 'edit/editFiles'],
    });
  });

  it('refuses to compile an agent with a tool absent from the registry', async () => {
    const bundle = await loadSpec(REPO_ROOT);
    const triage = bundle.files.find(({ path }) => path.endsWith('triage.agent.md'));
    if (!triage?.frontmatter.ok) throw new Error('triage.agent.md not found');
    triage.frontmatter.data.tools = ['read/readFile', 'web/fetch'];

    expect(() => compileAgents(bundle)).toThrow(
      'agent `triage` declares the unknown tool `web/fetch`',
    );
  });

  it('compiles the graph when the runtime starts', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SpecModule.forRoot({ root: REPO_ROOT }), GraphModule],
    }).compile();

    expect((await structure(moduleRef.get(GRAPH))).nodes).toContain('triage');
  });
});

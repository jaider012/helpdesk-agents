import { loadSpec } from 'agent-spec';
import { buildGraph, type GraphNodes } from '../src/graph/build.js';
import { compileAgents } from '../src/graph/compile-agents.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

/** Pass-through nodes: enough to compile and inspect the graph structure. */
export const PASS_THROUGH: GraphNodes = new Proxy({} as GraphNodes, { get: () => () => ({}) });

export async function realGraph(nodes: GraphNodes = PASS_THROUGH) {
  const bundle = await loadSpec(REPO_ROOT);
  return buildGraph(bundle, compileAgents(bundle), nodes);
}

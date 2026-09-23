import { Module } from '@nestjs/common';
import type { SpecBundle } from 'agent-spec';
import { SPEC_BUNDLE } from '../spec/spec.module.js';
import { buildGraph, type GraphNodes } from './build.js';
import { compileAgents } from './compile-agents.js';

/** Injection token of the compiled LangGraph graph. */
export const GRAPH = Symbol('GRAPH');

// Nodes whose behaviour is not implemented yet leave the state unchanged.
const keepState = () => ({});
const NODES: GraphNodes = {
  redact: keepState,
  triage: keepState,
  diagnostics: keepState,
  provisioning: keepState,
  escalation: keepState,
};

@Module({
  providers: [
    {
      provide: GRAPH,
      useFactory: (bundle: SpecBundle) => buildGraph(bundle, compileAgents(bundle), NODES),
      inject: [SPEC_BUNDLE],
    },
  ],
  exports: [GRAPH],
})
export class GraphModule {}

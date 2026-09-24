import { Module } from '@nestjs/common';
import type { SpecBundle } from 'agent-spec';
import { AUDIT_LOG, AuditModule } from '../audit/audit.module.js';
import type { AuditLog } from '../audit/audit-log.js';
import { GRAPH, GraphModule } from '../graph/graph.module.js';
import { SPEC_BUNDLE } from '../spec/spec.module.js';
import type { TicketStore } from '../tickets/ticket-store.js';
import { TICKET_STORE, TicketsModule } from '../tickets/tickets.module.js';
import { PromptRunner, type CompiledGraph } from './prompt-runner.js';
import { PromptsController } from './prompts.controller.js';
import { PROMPT_RUNNER } from './tokens.js';

export { PROMPT_RUNNER } from './tokens.js';

@Module({
  imports: [GraphModule, TicketsModule, AuditModule],
  controllers: [PromptsController],
  providers: [
    {
      provide: PROMPT_RUNNER,
      useFactory: (bundle: SpecBundle, graph: CompiledGraph, store: TicketStore, audit: AuditLog) =>
        new PromptRunner(bundle, graph, store, audit),
      inject: [SPEC_BUNDLE, GRAPH, TICKET_STORE, AUDIT_LOG],
    },
  ],
  exports: [PROMPT_RUNNER],
})
export class PromptsModule {}

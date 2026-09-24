import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Logger, Module } from '@nestjs/common';
import type { SpecBundle } from 'agent-spec';
import { AUDIT_LOG, AuditModule } from '../audit/audit.module.js';
import type { AuditLog } from '../audit/audit-log.js';
import { CHAT_MODEL, LlmModule } from '../llm/llm.module.js';
import { resolveLlmTimeoutMs } from '../llm/provider.js';
import { resolveRedactionSalt } from '../redact/redact-node.js';
import { SPEC_BUNDLE } from '../spec/spec.module.js';
import type { TicketStateMachine } from '../tickets/state-machine.js';
import type { TicketStore } from '../tickets/ticket-store.js';
import { STATE_MACHINE, TICKET_STORE, TicketsModule } from '../tickets/tickets.module.js';
import { buildGraph } from './build.js';
import { compileAgents } from './compile-agents.js';
import { createNodes } from './nodes/index.js';

/** Injection token of the compiled LangGraph graph. */
export const GRAPH = Symbol('GRAPH');
const REDACTION_SALT = Symbol('REDACTION_SALT');

@Module({
  imports: [LlmModule, AuditModule, TicketsModule],
  providers: [
    {
      provide: REDACTION_SALT,
      useFactory: () => {
        const { salt, warning } = resolveRedactionSalt(process.env);
        if (warning) new Logger('Redaction').warn(warning);
        return salt;
      },
    },
    {
      provide: GRAPH,
      useFactory: (
        bundle: SpecBundle,
        model: BaseChatModel,
        audit: AuditLog,
        store: TicketStore,
        machine: TicketStateMachine,
        salt: string,
      ) =>
        buildGraph(
          bundle,
          compileAgents(bundle),
          createNodes({
            bundle,
            model,
            audit,
            store,
            machine,
            salt,
            clock: () => new Date(),
            llmTimeoutMs: resolveLlmTimeoutMs(process.env),
          }),
        ),
      inject: [SPEC_BUNDLE, CHAT_MODEL, AUDIT_LOG, TICKET_STORE, STATE_MACHINE, REDACTION_SALT],
    },
  ],
  exports: [GRAPH],
})
export class GraphModule {}

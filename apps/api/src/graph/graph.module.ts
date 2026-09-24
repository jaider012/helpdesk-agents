import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Logger, Module } from '@nestjs/common';
import type { SpecBundle } from 'agent-spec';
import { AUDIT_LOG, AuditModule } from '../audit/audit.module.js';
import type { AuditLog } from '../audit/audit-log.js';
import { CHAT_MODEL, LlmModule } from '../llm/llm.module.js';
import { resolveRedactionSalt } from '../redact/redact-node.js';
import { SPEC_BUNDLE } from '../spec/spec.module.js';
import { buildGraph } from './build.js';
import { compileAgents } from './compile-agents.js';
import { createRedactNode } from './nodes/redact.node.js';
import { createTriageNode } from './nodes/triage.node.js';
import { triageRouteInput, withRouting } from './routing.js';
import { compileSeverityMatrix } from './severity-matrix.js';

/** Injection token of the compiled LangGraph graph. */
export const GRAPH = Symbol('GRAPH');
const REDACTION_SALT = Symbol('REDACTION_SALT');

// Nodes whose behaviour is not implemented yet leave the state unchanged (decision DC-43).
const keepState = () => ({});

@Module({
  imports: [LlmModule, AuditModule],
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
      useFactory: (bundle: SpecBundle, model: BaseChatModel, audit: AuditLog, salt: string) => {
        const agents = compileAgents(bundle);
        const triage = agents.find(({ name }) => name === 'triage');
        if (!triage) throw new Error('the spec has no triage agent');
        return buildGraph(bundle, agents, {
          redact: createRedactNode({ audit, salt }),
          triage: withRouting(
            'triage',
            createTriageNode({
              model,
              systemPrompt: triage.systemPrompt,
              severity: compileSeverityMatrix(triage.systemPrompt),
              audit,
            }),
            triageRouteInput,
            audit,
          ),
          diagnostics: keepState,
          provisioning: keepState,
          escalation: keepState,
        });
      },
      inject: [SPEC_BUNDLE, CHAT_MODEL, AUDIT_LOG, REDACTION_SALT],
    },
  ],
  exports: [GRAPH],
})
export class GraphModule {}

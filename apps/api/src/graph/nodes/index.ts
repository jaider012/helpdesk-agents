import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { SpecBundle } from 'agent-spec';
import type { AuditLog } from '../../audit/audit-log.js';
import { templatesFromBundle } from '../../messages/templates.js';
import type { TicketStateMachine } from '../../tickets/state-machine.js';
import { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { TicketStore } from '../../tickets/ticket-store.js';
import type { GraphNodes } from '../build.js';
import { compileAgents } from '../compile-agents.js';
import { triageRouteInput, withRouting } from '../routing.js';
import { compileSeverityMatrix } from '../severity-matrix.js';
import { createEscalationNode } from './escalation.node.js';
import { createRedactNode } from './redact.node.js';
import { createTriageNode } from './triage.node.js';

export interface NodeDeps {
  bundle: SpecBundle;
  model: BaseChatModel;
  audit: AuditLog;
  store: TicketStore;
  machine: TicketStateMachine;
  salt: string;
  clock: () => Date;
}

// Nodes whose behaviour is not implemented yet leave the state unchanged (decision DC-43).
const keepState = () => ({});

/** The nodes of the runtime graph, wired with their dependencies (design §2, §5). */
export function createNodes({
  bundle,
  model,
  audit,
  store,
  machine,
  salt,
  clock,
}: NodeDeps): GraphNodes {
  const triage = compileAgents(bundle).find(({ name }) => name === 'triage');
  if (!triage) throw new Error('the spec has no triage agent');
  const lifecycle = new TicketLifecycle(machine, audit, store);
  return {
    redact: createRedactNode({ audit, salt }),
    triage: withRouting(
      'triage',
      createTriageNode({
        model,
        systemPrompt: triage.systemPrompt,
        severity: compileSeverityMatrix(triage.systemPrompt),
        audit,
        lifecycle,
      }),
      triageRouteInput,
      audit,
    ),
    diagnostics: keepState,
    provisioning: keepState,
    escalation: createEscalationNode({
      audit,
      lifecycle,
      templates: templatesFromBundle(bundle),
      clock,
    }),
  };
}

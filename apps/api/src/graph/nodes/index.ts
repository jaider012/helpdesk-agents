import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { SpecBundle } from 'agent-spec';
import type { AuditLog } from '../../audit/audit-log.js';
import { templatesFromBundle } from '../../messages/templates.js';
import type { TicketStateMachine } from '../../tickets/state-machine.js';
import { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { TicketStore } from '../../tickets/ticket-store.js';
import { ActionService } from '../../tools/actions.js';
import { CheckVpnTool } from '../../tools/check-vpn-tool.js';
import { compileSkillScripts, SkillRunner } from '../../tools/skill-runner.js';
import type { GraphNodes } from '../build.js';
import { compileAgents } from '../compile-agents.js';
import {
  diagnosticsRouteInput,
  provisioningRouteInput,
  triageRouteInput,
  withRouting,
} from '../routing.js';
import { compileSeverityMatrix } from '../severity-matrix.js';
import { createDiagnosticsNode } from './diagnostics.node.js';
import { createEscalationNode } from './escalation.node.js';
import { createProvisioningNode } from './provisioning.node.js';
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
  llmTimeoutMs: number;
  /** `VPN_GATEWAY_TARGET` (design §2.2). */
  vpnTarget: string;
}

/** The nodes of the runtime graph, wired with their dependencies (design §2, §5). */
export function createNodes({
  bundle,
  model,
  audit,
  store,
  machine,
  salt,
  clock,
  llmTimeoutMs,
  vpnTarget,
}: NodeDeps): GraphNodes {
  const agents = compileAgents(bundle);
  const systemPrompt = (name: string) => {
    const agent = agents.find((candidate) => candidate.name === name);
    if (!agent) throw new Error(`the spec has no ${name} agent`);
    return agent.systemPrompt;
  };
  const lifecycle = new TicketLifecycle(machine, audit, store);
  const templates = templatesFromBundle(bundle);
  const vpnScript = compileSkillScripts(bundle).find(({ skill }) => skill === 'vpn-diagnostics');
  if (!vpnScript) throw new Error('the spec has no vpn-diagnostics script');
  return {
    redact: createRedactNode({ audit, salt }),
    triage: withRouting(
      'triage',
      createTriageNode({
        model,
        systemPrompt: systemPrompt('triage'),
        severity: compileSeverityMatrix(systemPrompt('triage')),
        audit,
        lifecycle,
        timeoutMs: llmTimeoutMs,
      }),
      triageRouteInput,
      audit,
    ),
    diagnostics: withRouting(
      'diagnostics',
      createDiagnosticsNode({
        lifecycle,
        actions: ActionService.fromBundle(bundle, audit, clock),
        checkVpn: new CheckVpnTool(new SkillRunner(audit), vpnScript, audit, clock),
        templates,
        vpnTarget,
        clock,
      }),
      diagnosticsRouteInput,
      audit,
    ),
    provisioning: withRouting(
      'provisioning',
      createProvisioningNode({ audit, lifecycle }),
      provisioningRouteInput,
      audit,
    ),
    escalation: createEscalationNode({
      model,
      systemPrompt: systemPrompt('escalation'),
      audit,
      lifecycle,
      templates,
      clock,
      handoffs: agents.flatMap(({ handoffs }) => handoffs),
    }),
  };
}

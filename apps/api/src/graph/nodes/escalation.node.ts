import type { EscalationReason } from 'agent-spec';
import type { AuditLog } from '../../audit/audit-log.js';
import type { MessageTemplates } from '../../messages/templates.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { Entities, EscalationPackage } from '../../tickets/ticket-state.js';
import { toTicketState, type GraphState, type GraphUpdate } from '../state.js';

export interface EscalationNodeDeps {
  audit: AuditLog;
  lifecycle: TicketLifecycle;
  templates: MessageTemplates;
  clock: () => Date;
}

/** The reason that the routing decision carried, or an operator request when there is none. */
function escalationReason(state: GraphState): EscalationReason {
  const route = state.lastRoute;
  return route?.to === 'escalation' && route.reason ? route.reason : 'operator_request';
}

/**
 * The escalation node (REQ-ESC-01..03): builds the escalation package, sets the ticket to
 * ESCALATED with the plain-language message and ends the run (it is terminal).
 */
export function createEscalationNode({ audit, lifecycle, templates, clock }: EscalationNodeDeps) {
  return async (state: GraphState): Promise<GraphUpdate> => {
    const { ticketId } = state;
    const reason = escalationReason(state);
    const escalationPackage: EscalationPackage = {
      ticketId,
      category: state.category ?? 'unknown',
      ...(state.severity && { severity: state.severity }),
      ...(state.entities && { entities: state.entities as Entities }),
      findings: state.findings,
      reason,
      summary: templates.render('internal.summary', { ticketId }),
      createdAt: clock().toISOString(),
    };
    const userMessage = templates.render('escalated', { ticketId });
    await audit.append({
      ticketId,
      agent: 'escalation',
      decision: 'escalated',
      reason,
      data: { reason },
    });
    const saved = await lifecycle.applyTransition(
      toTicketState({ ...state, escalationPackage, userMessage }),
      'ESCALATED',
      { agent: 'escalation', reason },
    );
    return { escalationPackage, userMessage, status: saved.status };
  };
}

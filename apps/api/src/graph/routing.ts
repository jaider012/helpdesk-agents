import {
  resolveRoute,
  type RouteInputs,
  type RoutingAgent,
  type TriageRouteInput,
} from 'agent-spec';
import type { AuditLog } from '../audit/audit-log.js';
import type { TicketState } from '../tickets/ticket-state.js';
import type { GraphNode } from './build.js';
import type { GraphState, GraphUpdate } from './state.js';

/** Builds the typed route input of an agent from the state and the update of its node. */
export type RouteInputOf<A extends RoutingAgent> = (
  state: GraphState,
  update: GraphUpdate,
) => RouteInputs[A];

/**
 * Triage routes on its classification (R-T1..R-T5), on the failure of its LLM call (R-X1, R-X2)
 * and, without a classification, on an internal error (R-X3).
 */
export const triageRouteInput: RouteInputOf<'triage'> = (state, update): TriageRouteInput => {
  if (update.llmFailure) return { kind: 'error', error: update.llmFailure };
  const category = update.category ?? state.category;
  const severity = update.severity ?? state.severity;
  return category && severity
    ? { kind: 'ok', category, severity }
    : { kind: 'error', error: 'internal' };
};

/**
 * Applies `routing.ts` when the node finishes: resolves the target, records the decision with its
 * rule in the audit log (REQ-AUD-04) and stores it in `lastRoute` and `nextAgent`.
 */
export function withRouting<A extends RoutingAgent>(
  agent: A,
  node: GraphNode,
  routeInputOf: RouteInputOf<A>,
  audit: AuditLog,
): GraphNode {
  return async (state) => {
    const update = await node(state);
    const decision = resolveRoute(agent, routeInputOf(state, update));
    await audit.append({
      ticketId: state.ticketId,
      agent,
      decision: 'routed',
      reason: decision.reason ?? `rule ${decision.rule}`,
      from: agent,
      to: decision.to,
      data: { rule: decision.rule, ...(decision.reason && { reason: decision.reason }) },
    });
    return {
      ...update,
      lastRoute: decision,
      ...(decision.to !== 'END' && { nextAgent: decision.to as TicketState['nextAgent'] }),
    };
  };
}

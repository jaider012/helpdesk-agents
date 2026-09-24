import {
  resolveRoute,
  type RouteInputs,
  type RoutingAgent,
  type TriageRouteInput,
} from 'agent-spec';
import type { AuditLog } from '../audit/audit-log.js';
import type { TicketState } from '../tickets/ticket-state.js';
import type { TicketStore } from '../tickets/ticket-store.js';
import type { GraphNode } from './build.js';
import { isIoError } from './errors.js';
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

/** Diagnostics routes on the outcome of its procedure; without one, on an internal error (R-X3). */
export const diagnosticsRouteInput: RouteInputOf<'diagnostics'> = (_, update) =>
  update.diagnosticsOutcome
    ? { kind: 'outcome', outcome: update.diagnosticsOutcome }
    : { kind: 'error', error: 'internal' };

/** Provisioning routes to approval once it normalized the request; otherwise, an internal error. */
export const provisioningRouteInput: RouteInputOf<'provisioning'> = (state, update) =>
  state.category === 'provisioning' && update.entities?.request
    ? { kind: 'ok' }
    : { kind: 'error', error: 'internal' };

/**
 * Applies `routing.ts` when the node finishes: resolves the target, records the decision with its
 * rule in the audit log (REQ-AUD-04) and stores it in `lastRoute` and `nextAgent`. An unexpected
 * error of the node is recorded and routed as an internal error (R-X3, REQ-ESC-08); a write failure
 * of the audit log or the ticket store stops the run. With `store`, the status after an error is
 * the persisted one, since the node may have moved the ticket before failing.
 */
export function withRouting<A extends RoutingAgent>(
  agent: A,
  node: GraphNode,
  routeInputOf: RouteInputOf<A>,
  audit: AuditLog,
  store?: TicketStore,
): GraphNode {
  const internal = { kind: 'error', error: 'internal' } as RouteInputs[A];

  async function recover(state: GraphState, error: unknown): Promise<GraphUpdate> {
    if (isIoError(error)) throw error;
    await audit.append({
      ticketId: state.ticketId,
      agent,
      decision: 'error',
      reason: `unexpected error in the ${agent} node`,
      data: { error: error instanceof Error ? error.name : typeof error },
    });
    const persisted = await store?.read(state.ticketId);
    return persisted ? { status: persisted.status } : {};
  }

  return async (state) => {
    let update: GraphUpdate;
    let input: RouteInputs[A];
    try {
      update = await node(state);
      input = routeInputOf(state, update);
    } catch (error) {
      update = await recover(state, error);
      input = internal;
    }
    const decision = resolveRoute(agent, input);
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

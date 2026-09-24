import type { AuditLog } from '../../audit/audit-log.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { AccessRequest, Entities } from '../../tickets/ticket-state.js';
import { mergeUpdate, toTicketState, type GraphState, type GraphUpdate } from '../state.js';

export interface ProvisioningNodeDeps {
  audit: AuditLog;
  lifecycle: TicketLifecycle;
}

const ACCESS_LEVELS: ReadonlySet<string> = new Set(['read', 'write', 'admin', 'license']);

const clean = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

/**
 * The request with exactly resource, accessLevel and justification (REQ-2.3-35): trimmed text, the
 * license level for licenses and read (least privilege) when the level is unknown.
 */
export function normalizeRequest(entities: Partial<Entities> | undefined): AccessRequest {
  const request: Partial<Record<keyof AccessRequest, unknown>> = entities?.request ?? {};
  const level = clean(request.accessLevel);
  const accessLevel =
    entities?.issueType === 'license'
      ? 'license'
      : ACCESS_LEVELS.has(level)
        ? (level as AccessRequest['accessLevel'])
        : 'read';
  return {
    resource: clean(request.resource),
    accessLevel,
    justification: clean(request.justification),
  };
}

/**
 * The provisioning node (design §5.1): without LLM, normalizes the access request and takes the
 * case (T3). It never grants anything: R-P1 sends the request to escalation for approval.
 */
export function createProvisioningNode({ audit, lifecycle }: ProvisioningNodeDeps) {
  return async (state: GraphState): Promise<GraphUpdate> => {
    // Another category here is an internal error: without a request, the route is R-X3.
    if (state.category !== 'provisioning') return {};
    const request = normalizeRequest(state.entities);
    const entities = { ...state.entities, request };
    const saved = await lifecycle.applyTransition(
      toTicketState(mergeUpdate(state, { entities })),
      'IN_PROGRESS',
      { agent: 'provisioning', reason: 'provisioning structures the access request' },
    );
    await audit.append({
      ticketId: state.ticketId,
      agent: 'provisioning',
      decision: 'node_finished',
      reason: 'access request normalized for approval',
      data: { resource: request.resource, accessLevel: request.accessLevel },
    });
    return { entities, status: saved.status };
  };
}

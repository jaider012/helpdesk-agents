import type { TicketStatus } from 'agent-spec';
import type { AuditEntry } from '../audit/audit-entry.js';
import type { AuditLog } from '../audit/audit-log.js';
import { TransitionError, type TicketStateMachine } from './state-machine.js';
import type { TicketState } from './ticket-state.js';
import type { TicketStore } from './ticket-store.js';

export interface TransitionContext {
  agent: AuditEntry['agent'];
  reason: string;
  data?: Record<string, unknown>;
}

/** Applies status transitions: the only way the runtime changes `status`. */
export class TicketLifecycle {
  private readonly machine: TicketStateMachine;
  private readonly audit: AuditLog;
  private readonly store: TicketStore;

  constructor(machine: TicketStateMachine, audit: AuditLog, store: TicketStore) {
    this.machine = machine;
    this.audit = audit;
    this.store = store;
  }

  /**
   * Validates the transition, records it in the audit log and persists the new state, in this
   * order: without its audit entry, the status does not change (REQ-AUD-03). A rejected
   * transition is recorded as `transition_rejected` and rethrown.
   */
  async applyTransition(
    candidate: TicketState,
    to: TicketStatus,
    context: TransitionContext,
  ): Promise<TicketState> {
    const { agent, reason, data } = context;
    const entry = { ticketId: candidate.ticketId, agent, reason, from: candidate.status, to };
    try {
      this.machine.validateTransition(candidate, to);
    } catch (error) {
      if (error instanceof TransitionError) {
        await this.audit.append({
          ...entry,
          decision: 'transition_rejected',
          data: { ...data, code: error.code },
        });
      }
      throw error;
    }
    await this.audit.append({ ...entry, decision: 'transition', ...(data && { data }) });
    const next: TicketState = { ...candidate, status: to };
    await this.store.save(next);
    return next;
  }
}

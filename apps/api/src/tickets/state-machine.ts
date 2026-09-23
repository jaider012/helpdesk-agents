import {
  compileLifecycle,
  LIFECYCLE_PATH,
  type SpecBundle,
  type StateMachineSpec,
  type TicketStatus,
  type TransitionSpec,
} from 'agent-spec';
import { describePredicate, holds } from './predicates.js';
import type { TicketState } from './ticket-state.js';

export type TransitionErrorCode =
  'INVALID_TRANSITION' | 'MISSING_REQUIRED_FIELDS' | 'RESOLUTION_INCOMPLETE';

export class TransitionError extends Error {
  readonly code: TransitionErrorCode;

  constructor(code: TransitionErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'TransitionError';
    this.code = code;
  }
}

/**
 * Ticket state machine compiled from the transitions table of `ticket-lifecycle.instructions.md`
 * (REQ-2.1-04). It knows no transition that the table does not list.
 */
export class TicketStateMachine {
  readonly transitions: readonly TransitionSpec[];

  constructor(spec: StateMachineSpec) {
    this.transitions = spec.transitions;
  }

  static fromLifecycle(body: string): TicketStateMachine {
    const { spec, issues } = compileLifecycle(body);
    if (issues.length > 0) {
      throw new Error(
        `invalid transitions table: ${issues.map(({ message }) => message).join('; ')}`,
      );
    }
    return new TicketStateMachine(spec);
  }

  static fromBundle(bundle: SpecBundle): TicketStateMachine {
    const file = bundle.files.find(({ path }) => path === LIFECYCLE_PATH);
    if (!file?.frontmatter.ok) throw new Error(`${LIFECYCLE_PATH} is missing or invalid`);
    return TicketStateMachine.fromLifecycle(file.frontmatter.body);
  }

  allowedFrom(status: TicketStatus): TicketStatus[] {
    return this.transitions.filter(({ from }) => from === status).map(({ to }) => to);
  }

  /** The table row of `from → to`; INVALID_TRANSITION otherwise (REQ-2.1-05, REQ-2.1-10). */
  assertTransition(from: TicketStatus, to: TicketStatus): TransitionSpec {
    const transition = this.transitions.find((row) => row.from === from && row.to === to);
    if (!transition) {
      const allowed = this.allowedFrom(from);
      throw new TransitionError(
        'INVALID_TRANSITION',
        `${from} → ${to} is not in the transitions table; allowed from ${from}: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`,
      );
    }
    return transition;
  }

  /**
   * Checks a transition of `candidate`, the ticket with its new data still in its current status:
   * the table row first, then its required fields (REQ-2.1-06..09, REQ-COM-01).
   */
  validateTransition(candidate: TicketState, to: TicketStatus): TransitionSpec {
    const transition = this.assertTransition(candidate.status, to);
    const missing = transition.required
      .filter((predicate) => !holds(predicate, candidate))
      .map(describePredicate);
    if (missing.length > 0) {
      throw new TransitionError(
        to === 'RESOLVED' ? 'RESOLUTION_INCOMPLETE' : 'MISSING_REQUIRED_FIELDS',
        `${candidate.status} → ${to} (${transition.id}) lacks ${missing.join(', ')}`,
      );
    }
    return transition;
  }
}

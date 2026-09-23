import {
  compileAllowlist,
  type AgentName,
  type AllowlistAction,
  type SpecBundle,
} from 'agent-spec';
import type { AuditLog } from '../audit/audit-log.js';
import type { ExecutedAction, TicketState } from '../tickets/ticket-state.js';

const DIAGNOSTICS_PATH = '.github/agents/diagnostics.agent.md';

export class ActionError extends Error {
  readonly code = 'ACTION_NOT_ALLOWLISTED';

  constructor(message: string) {
    super(`ACTION_NOT_ALLOWLISTED: ${message}`);
    this.name = 'ActionError';
  }
}

/**
 * Runs remediation actions, only those of the allowlist compiled from `diagnostics.agent.md`
 * (REQ-2.3-31, REQ-2.3-34), and none while the ticket is ESCALATED (REQ-2.1-11).
 */
export class ActionService {
  private readonly allowlist: readonly AllowlistAction[];
  private readonly audit: AuditLog;
  private readonly clock: () => Date;

  constructor(allowlist: readonly AllowlistAction[], audit: AuditLog, clock = () => new Date()) {
    this.allowlist = allowlist;
    this.audit = audit;
    this.clock = clock;
  }

  static fromAllowlistBody(body: string, audit: AuditLog, clock?: () => Date): ActionService {
    return new ActionService(compileAllowlist(body), audit, clock);
  }

  static fromBundle(bundle: SpecBundle, audit: AuditLog, clock?: () => Date): ActionService {
    const file = bundle.files.find(({ path }) => path === DIAGNOSTICS_PATH);
    if (!file?.frontmatter.ok) throw new Error(`${DIAGNOSTICS_PATH} is missing or invalid`);
    return ActionService.fromAllowlistBody(file.frontmatter.body, audit, clock);
  }

  get allowlistedIds(): string[] {
    return this.allowlist.map(({ id }) => id);
  }

  async execute(ticket: TicketState, actionId: string, agent: AgentName): Promise<ExecutedAction> {
    const action = this.allowlist.find(({ id }) => id === actionId);
    const { ticketId } = ticket;
    if (ticket.status === 'ESCALATED' || !action) {
      const reason =
        ticket.status === 'ESCALATED'
          ? 'no remediation action runs while the ticket is ESCALATED'
          : `action \`${actionId}\` is not in the remediation allowlist`;
      const data = { action: actionId, code: 'ACTION_NOT_ALLOWLISTED' };
      await this.audit.append({ ticketId, agent, decision: 'action_rejected', reason, data });
      throw new ActionError(reason);
    }
    const executed: ExecutedAction = {
      id: action.id,
      kind: action.kind === 'automated' ? 'automated' : 'instruction',
      allowlisted: true,
      agent,
      result: 'delivered',
      ts: this.clock().toISOString(),
    };
    await this.audit.append({
      ticketId,
      agent,
      decision: 'action_executed',
      reason: action.description,
      data: { action: action.id, kind: executed.kind },
    });
    return executed;
  }
}

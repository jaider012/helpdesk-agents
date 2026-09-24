import type { Category, DiagnosticsOutcome } from 'agent-spec';
import type { MessageTemplates } from '../../messages/templates.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { DiagnosticFinding, IssueType } from '../../tickets/ticket-state.js';
import type { ActionService } from '../../tools/actions.js';
import type { CheckVpnTool } from '../../tools/check-vpn-tool.js';
import { mergeUpdate, toTicketState, type GraphState, type GraphUpdate } from '../state.js';

export interface DiagnosticsNodeDeps {
  lifecycle: TicketLifecycle;
  actions: ActionService;
  checkVpn: CheckVpnTool;
  templates: MessageTemplates;
  /** `VPN_GATEWAY_TARGET`: the gateway that the vpn-diagnostics skill checks. */
  vpnTarget: string;
  clock: () => Date;
}

const IDENTITY_ISSUES: ReadonlySet<IssueType> = new Set([
  'password_reset',
  'mfa',
  'disabled_account',
]);

type Procedure = 'vpn' | 'lockout' | 'identity_action' | 'no_skill';

/** The deterministic procedure of design §2.2 for a category and an issue type. */
function procedureFor(category: Category | undefined, issueType: IssueType | undefined): Procedure {
  if (category === 'infra' && issueType === 'vpn') return 'vpn';
  if (category === 'access' && issueType === 'lockout') return 'lockout';
  if (category === 'access' && issueType && IDENTITY_ISSUES.has(issueType)) {
    return 'identity_action';
  }
  return 'no_skill';
}

/**
 * The diagnostics node (design §2.2): applies the procedure of the ticket and reports its outcome
 * for R-D1..R-D8. Only the steps of the procedure run here; routing and escalation are code outside.
 */
export function createDiagnosticsNode({
  lifecycle,
  actions,
  checkVpn,
  templates,
  vpnTarget,
  clock,
}: DiagnosticsNodeDeps) {
  /** Moves the ticket to IN_PROGRESS when diagnostics takes the case (T3). */
  async function takeCase(state: GraphState): Promise<GraphState> {
    if (state.status === 'IN_PROGRESS') return state;
    const saved = await lifecycle.applyTransition(toTicketState(state), 'IN_PROGRESS', {
      agent: 'diagnostics',
      reason: 'diagnostics takes the case',
    });
    return { ...state, status: saved.status };
  }

  /**
   * Delivers an allowlisted action after a conclusive finding and resolves the ticket (T5), with the
   * plain-language template of the action as `userMessage`.
   */
  async function resolveWith(
    current: GraphState,
    finding: DiagnosticFinding,
    actionId: string,
    outcome: DiagnosticsOutcome,
  ): Promise<GraphUpdate> {
    const { ticketId } = current;
    const found = { status: current.status, findings: [finding] };
    const action = await actions.execute(
      toTicketState(mergeUpdate(current, found)),
      actionId,
      'diagnostics',
    );
    const update = {
      ...found,
      actions: [action],
      userMessage: templates.render(`resolved.${action.id}`, { ticketId }),
    };
    const saved = await lifecycle.applyTransition(
      toTicketState(mergeUpdate(current, update)),
      'RESOLVED',
      { agent: 'diagnostics', reason: `${finding.cause} and ${action.id} was delivered` },
    );
    return { ...update, status: saved.status, diagnosticsOutcome: outcome };
  }

  /** The vpn-diagnostics skill (REQ-2.2-09, REQ-2.2-28, REQ-2.2-29). */
  async function diagnoseVpn(state: GraphState): Promise<GraphUpdate> {
    const current = await takeCase(state);
    const { finding, outcome } = await checkVpn.run(vpnTarget, {
      ticketId: current.ticketId,
      findingId: `fnd_${current.findings.length + 1}`,
    });
    if (outcome !== 'vpn_ok') {
      return { status: current.status, findings: [finding], diagnosticsOutcome: outcome };
    }
    return resolveWith(current, finding, 'instruct_vpn_reconnect', 'vpn_ok');
  }

  /** A lockout by retries: a rule finding and the self-service unlock instruction (REQ-2.3-27). */
  async function instructUnlock(state: GraphState): Promise<GraphUpdate> {
    const current = await takeCase(state);
    const finding: DiagnosticFinding = {
      id: `fnd_${current.findings.length + 1}`,
      source: 'rule',
      conclusive: true,
      cause: 'account_locked_by_retries',
      summary: 'triage classified the ticket as an account lockout by repeated attempts',
      durationMs: 0,
      ts: clock().toISOString(),
    };
    return resolveWith(current, finding, 'instruct_self_service_unlock', 'lockout_instructed');
  }

  return async (state: GraphState): Promise<GraphUpdate> => {
    const procedure = procedureFor(state.category, state.entities?.issueType);
    if (procedure === 'vpn') return diagnoseVpn(state);
    if (procedure === 'lockout') return instructUnlock(state);
    return { diagnosticsOutcome: procedure };
  };
}

import type { Category } from 'agent-spec';
import type { MessageTemplates } from '../../messages/templates.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { IssueType } from '../../tickets/ticket-state.js';
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
}

const IDENTITY_ISSUES: ReadonlySet<IssueType> = new Set([
  'password_reset',
  'mfa',
  'disabled_account',
]);

type Procedure = 'vpn' | 'identity_action' | 'no_skill';

/** The deterministic procedure of design §2.2 for a category and an issue type. */
function procedureFor(category: Category | undefined, issueType: IssueType | undefined): Procedure {
  if (category === 'infra' && issueType === 'vpn') return 'vpn';
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

  /** The vpn-diagnostics skill (REQ-2.2-09, REQ-2.2-28, REQ-2.2-29). */
  async function diagnoseVpn(state: GraphState): Promise<GraphUpdate> {
    const current = await takeCase(state);
    const { ticketId } = current;
    const { finding, outcome } = await checkVpn.run(vpnTarget, {
      ticketId,
      findingId: `fnd_${current.findings.length + 1}`,
    });
    const found = { status: current.status, findings: [finding] };
    if (outcome !== 'vpn_ok') return { ...found, diagnosticsOutcome: outcome };

    const withFinding = mergeUpdate(current, found);
    const action = await actions.execute(
      toTicketState(withFinding),
      'instruct_vpn_reconnect',
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
      { agent: 'diagnostics', reason: `the gateway responds and ${action.id} was delivered` },
    );
    return { ...update, status: saved.status, diagnosticsOutcome: 'vpn_ok' };
  }

  return async (state: GraphState): Promise<GraphUpdate> => {
    const procedure = procedureFor(state.category, state.entities?.issueType);
    if (procedure === 'vpn') return diagnoseVpn(state);
    return { diagnosticsOutcome: procedure };
  };
}

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { OutputParserException } from '@langchain/core/output_parsers';
import type { Category, DiagnosticsOutcome, HandoffEdge, TicketStatus } from 'agent-spec';
import { z } from 'zod';
import type { AuditLog } from '../../audit/audit-log.js';
import type { UserMessageGuard } from '../../guards/user-message.guard.js';
import { DRAFT_MESSAGE_TOOL } from '../../llm/fake-responder.js';
import type { MessageTemplates } from '../../messages/templates.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { DiagnosticFinding, IssueType } from '../../tickets/ticket-state.js';
import { ActionError, type ActionService } from '../../tools/actions.js';
import type { CheckVpnTool } from '../../tools/check-vpn-tool.js';
import { isIoError } from '../errors.js';
import { handoffEnvelope, handoffMessages } from '../handoff.js';
import { mergeUpdate, toTicketState, type GraphState, type GraphUpdate } from '../state.js';

/** The user message that the LLM drafts from the template of the outcome (design §5.1). */
const MessageDraft = z.object({ userMessage: z.string().min(1) });

export interface DiagnosticsNodeDeps {
  model: BaseChatModel;
  systemPrompt: string;
  audit: AuditLog;
  guard: UserMessageGuard;
  /** Limit of the drafting call (`LLM_TIMEOUT_MS`, REQ-COM-06). */
  timeoutMs: number;
  handoffs: readonly HandoffEdge[];
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

type Procedure = 'vpn' | 'lockout' | 'ask_user' | 'identity_action' | 'no_skill';

/** The deterministic procedure of design §2.2 for a category and an issue type. */
function procedureFor(category: Category | undefined, issueType: IssueType | undefined): Procedure {
  if (category === 'infra' && issueType === 'vpn') return 'vpn';
  if (category === 'access' && issueType === 'lockout') return 'lockout';
  if ((category === 'infra' || category === 'access') && issueType === 'unknown') return 'ask_user';
  if (category === 'access' && issueType && IDENTITY_ISSUES.has(issueType)) {
    return 'identity_action';
  }
  return 'no_skill';
}

/**
 * The diagnostics node (design §2.2): applies the procedure of the ticket and reports its outcome
 * for R-D1..R-D8. Only the steps of the procedure run here; routing and escalation are code outside.
 */
export function createDiagnosticsNode(deps: DiagnosticsNodeDeps) {
  const { model, systemPrompt, audit, guard, timeoutMs, handoffs } = deps;
  const { lifecycle, actions, checkVpn, templates, vpnTarget, clock } = deps;
  const drafter = model.withStructuredOutput(MessageDraft, { name: DRAFT_MESSAGE_TOOL });

  const replaced = (ticketId: string, cause: string) =>
    audit.append({
      ticketId,
      agent: 'diagnostics',
      decision: 'message_replaced',
      reason: 'the plain-language template replaces the drafted text',
      data: { cause },
    });

  /**
   * The user message for `status`: the LLM drafts it from the template with only the handoff
   * envelope; a failed, late or invalid draft, or one that breaks a guard, gives the template.
   */
  async function userMessageFor(
    state: GraphState,
    templateKey: string,
    status: TicketStatus,
  ): Promise<string> {
    const { ticketId } = state;
    const template = templates.render(templateKey, { ticketId });
    let drafted: string;
    try {
      const envelope = handoffEnvelope(state, 'diagnostics', handoffs);
      const result = MessageDraft.safeParse(
        await drafter.invoke(handoffMessages(systemPrompt, envelope, template), {
          signal: AbortSignal.timeout(timeoutMs),
        }),
      );
      if (!result.success) {
        await replaced(ticketId, 'invalid_llm_output');
        return template;
      }
      drafted = result.data.userMessage;
    } catch (error) {
      if (isIoError(error)) throw error;
      const cause =
        error instanceof OutputParserException ? 'invalid_llm_output' : 'llm_unavailable';
      await replaced(ticketId, cause);
      return template;
    }
    const broken = guard.check(drafted, { ticketId, status });
    if (broken) {
      await replaced(ticketId, broken);
      return template;
    }
    return drafted;
  }

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
   * user message drafted from the template of the action. A rejected action routes to escalation
   * (R-D8, REQ-2.3-32); the action service has already audited the rejection.
   */
  async function resolveWith(
    current: GraphState,
    finding: DiagnosticFinding,
    actionId: string,
    outcome: DiagnosticsOutcome,
  ): Promise<GraphUpdate> {
    const found = { status: current.status, findings: [finding] };
    let action;
    try {
      action = await actions.execute(
        toTicketState(mergeUpdate(current, found)),
        actionId,
        'diagnostics',
      );
    } catch (error) {
      if (error instanceof ActionError) return { ...found, diagnosticsOutcome: 'action_rejected' };
      throw error;
    }
    const update = {
      ...found,
      actions: [action],
      userMessage: await userMessageFor(current, `resolved.${action.id}`, 'RESOLVED'),
    };
    const saved = await lifecycle.applyTransition(
      toTicketState(mergeUpdate(current, update)),
      'RESOLVED',
      { agent: 'diagnostics', reason: `${finding.cause} and ${action.id} was delivered` },
    );
    return { ...update, status: saved.status, diagnosticsOutcome: outcome };
  }

  /** The vpn-diagnostics skill (REQ-2.2-09, REQ-2.2-28, REQ-2.2-29). */
  async function diagnoseVpn(state: GraphState, target: string): Promise<GraphUpdate> {
    const current = await takeCase(state);
    const { finding, outcome } = await checkVpn.run(target, {
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

  /** Without an issue type there is no procedure: ask the user for it (T6, REQ-2.3-30). */
  async function askUser(state: GraphState): Promise<GraphUpdate> {
    const current = await takeCase(state);
    const userMessage = await userMessageFor(current, 'waiting_user', 'WAITING_USER');
    const saved = await lifecycle.applyTransition(
      toTicketState({ ...current, userMessage }),
      'WAITING_USER',
      { agent: 'diagnostics', reason: 'the ticket lacks the issue type' },
    );
    return { status: saved.status, userMessage, diagnosticsOutcome: 'needs_user_input' };
  }

  return async (state: GraphState): Promise<GraphUpdate> => {
    // run-vpn-diagnostics applies the skill to its target, whatever the category (design §2.2).
    const promptTarget =
      state.entryAgent === 'diagnostics' ? state.prompt?.variables.target : undefined;
    if (promptTarget) return diagnoseVpn(state, promptTarget);
    const procedure = procedureFor(state.category, state.entities?.issueType);
    if (procedure === 'vpn') return diagnoseVpn(state, vpnTarget);
    if (procedure === 'lockout') return instructUnlock(state);
    if (procedure === 'ask_user') return askUser(state);
    return { diagnosticsOutcome: procedure };
  };
}

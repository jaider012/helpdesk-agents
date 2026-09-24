import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ROUTING_RULES, type EscalationReason, type HandoffEdge } from 'agent-spec';
import { z } from 'zod';
import type { AuditLog } from '../../audit/audit-log.js';
import type { UserMessageGuard } from '../../guards/user-message.guard.js';
import { DRAFT_TOOL } from '../../llm/fake-responder.js';
import type { MessageTemplates } from '../../messages/templates.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { ApprovalRequest, Entities, EscalationPackage } from '../../tickets/ticket-state.js';
import { isIoError } from '../errors.js';
import { handoffEnvelope, handoffMessages } from '../handoff.js';
import { toTicketState, type GraphState, type GraphUpdate } from '../state.js';
import type { TeamDirectory } from '../teams.js';

/** The texts the LLM drafts in escalation (design §5.1). */
export const EscalationDraft = z.object({
  summary: z.string().min(1),
  userMessage: z.string().min(1),
});

export interface EscalationNodeDeps {
  model: BaseChatModel;
  systemPrompt: string;
  audit: AuditLog;
  lifecycle: TicketLifecycle;
  templates: MessageTemplates;
  clock: () => Date;
  /** The handoffs of the spec, for the prompt of the envelope (REQ-2.3-17). */
  handoffs: readonly HandoffEdge[];
  /** The guards of the user message (design §8.2). */
  guard: UserMessageGuard;
  /** Limit of the drafting call (`LLM_TIMEOUT_MS`, REQ-COM-06). */
  timeoutMs: number;
  /** The team of each category, from `## Equipos de escalamiento` (REQ-ESC-07). */
  teams: TeamDirectory;
}

/** Every escalation reason code: those of the routing rules and the operator request. */
const REASON_CODES: ReadonlySet<string> = new Set([
  ...Object.values(ROUTING_RULES).flatMap((rules) =>
    (rules as ReadonlyArray<{ reason?: string }>).flatMap(({ reason }) => (reason ? [reason] : [])),
  ),
  'operator_request',
]);

/**
 * The reason that the routing decision carried; without one, the reason of an escalate-ticket run
 * when it is a reason code, or an operator request otherwise.
 */
function escalationReason(state: GraphState): EscalationReason {
  const route = state.lastRoute;
  if (route?.to === 'escalation' && route.reason) return route.reason;
  const requested = state.prompt?.variables.reason?.trim() ?? '';
  return REASON_CODES.has(requested) ? (requested as EscalationReason) : 'operator_request';
}

/**
 * The approval request of a provisioning ticket, derived without LLM from `entities.request` and
 * `entities.userRef` (REQ-ESC-09).
 */
function approvalRequestFor(state: GraphState, templates: MessageTemplates): ApprovalRequest {
  const { resource = '', accessLevel = '', justification = '' } = state.entities?.request ?? {};
  return {
    resource,
    accessLevel,
    requesterRef: state.entities?.userRef ?? 'usr_unknown',
    justification,
    complete: [resource, accessLevel, justification].every((field) => field.trim() !== ''),
    summary: templates.render('internal.approval', { ticketId: state.ticketId }),
  };
}

/**
 * The escalation node (REQ-ESC-01..03, ESC-06, ESC-10, COM-03): builds the escalation package,
 * sets the ticket to ESCALATED and ends the run. The LLM drafts the summary and the user message;
 * without it, or when the node fails for any reason other than I/O, the templates are used.
 */
export function createEscalationNode(deps: EscalationNodeDeps) {
  const { model, systemPrompt, audit, lifecycle, templates, clock, handoffs, guard } = deps;
  const { timeoutMs, teams } = deps;
  const draft = model.withStructuredOutput(EscalationDraft, { name: DRAFT_TOOL });

  const replaced = (ticketId: string, cause: string) =>
    audit.append({
      ticketId,
      agent: 'escalation',
      decision: 'message_replaced',
      reason: 'the plain-language template replaces the drafted text',
      data: { cause },
    });

  /** The drafted texts, or the templates with the cause of the replacement. */
  async function texts(state: GraphState) {
    const { ticketId } = state;
    const template = {
      summary: templates.render('internal.summary', { ticketId }),
      userMessage: templates.render('escalated', { ticketId }),
    };
    let drafted: z.infer<typeof EscalationDraft>;
    try {
      // Only the handoff envelope travels to the LLM, never the ticket text (REQ-2.3-17).
      const envelope = handoffEnvelope(state, 'escalation', handoffs);
      const result = EscalationDraft.safeParse(
        await draft.invoke(handoffMessages(systemPrompt, envelope), {
          signal: AbortSignal.timeout(timeoutMs),
        }),
      );
      if (!result.success) {
        await replaced(ticketId, 'invalid_llm_output');
        return template;
      }
      drafted = result.data;
    } catch (error) {
      if (isIoError(error)) throw error;
      await replaced(ticketId, 'llm_unavailable');
      return template;
    }
    const broken = guard.check(drafted.userMessage, { ticketId, status: 'ESCALATED' });
    if (broken) {
      await replaced(ticketId, broken);
      return { summary: drafted.summary, userMessage: template.userMessage };
    }
    return drafted;
  }

  async function escalate(state: GraphState, withLlm: boolean): Promise<GraphUpdate> {
    const { ticketId } = state;
    const reason = escalationReason(state);
    const category = state.category ?? 'unknown';
    const targetTeam = teams(category);
    const base: Omit<EscalationPackage, 'summary'> = {
      ticketId,
      category,
      ...(state.severity && { severity: state.severity }),
      ...(state.entities && { entities: state.entities as Entities }),
      findings: state.findings,
      reason,
      ...(targetTeam && { targetTeam }),
      ...(state.category === 'provisioning' && {
        approvalRequest: approvalRequestFor(state, templates),
      }),
      createdAt: clock().toISOString(),
    };
    const { summary, userMessage } = withLlm
      ? await texts(state)
      : {
          summary: templates.render('internal.summary', { ticketId }),
          userMessage: templates.render('escalated', { ticketId }),
        };
    const escalationPackage: EscalationPackage = { ...base, summary };
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
  }

  return async (state: GraphState): Promise<GraphUpdate> => {
    try {
      return await escalate(state, true);
    } catch (error) {
      if (isIoError(error)) throw error;
      await audit.append({
        ticketId: state.ticketId,
        agent: 'escalation',
        decision: 'error',
        reason: 'unexpected error while escalating: the deterministic template is used',
        data: { error: error instanceof Error ? error.name : 'unknown' },
      });
      return escalate(state, false);
    }
  };
}

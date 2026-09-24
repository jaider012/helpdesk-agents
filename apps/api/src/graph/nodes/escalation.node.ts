import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { EscalationReason } from 'agent-spec';
import { z } from 'zod';
import type { AuditLog } from '../../audit/audit-log.js';
import { DRAFT_TOOL } from '../../llm/fake-responder.js';
import type { MessageTemplates } from '../../messages/templates.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import type { Entities, EscalationPackage } from '../../tickets/ticket-state.js';
import { toTicketState, type GraphState, type GraphUpdate } from '../state.js';

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
}

/** The reason that the routing decision carried, or an operator request when there is none. */
function escalationReason(state: GraphState): EscalationReason {
  const route = state.lastRoute;
  return route?.to === 'escalation' && route.reason ? route.reason : 'operator_request';
}

/** Write failures of the audit log or the ticket store stop the run (REQ-AUD-06, REQ-AUD-08). */
function isIoError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code } = error as { code?: unknown };
  return 'errno' in error || code === 'AUDIT_WRITE_FAILED' || code === 'STORE_WRITE_FAILED';
}

/**
 * The escalation node (REQ-ESC-01..03, ESC-06, ESC-10, COM-03): builds the escalation package,
 * sets the ticket to ESCALATED and ends the run. The LLM drafts the summary and the user message;
 * without it, or when the node fails for any reason other than I/O, the templates are used.
 */
export function createEscalationNode(deps: EscalationNodeDeps) {
  const { model, systemPrompt, audit, lifecycle, templates, clock } = deps;
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
  async function texts(state: GraphState, base: Omit<EscalationPackage, 'summary'>) {
    const { ticketId } = state;
    const template = {
      summary: templates.render('internal.summary', { ticketId }),
      userMessage: templates.render('escalated', { ticketId }),
    };
    let drafted: z.infer<typeof EscalationDraft>;
    try {
      // Only the handoff context travels to the LLM, never the ticket text (REQ-2.3-17).
      const result = EscalationDraft.safeParse(
        await draft.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(JSON.stringify(base)),
        ]),
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
    if (!drafted.userMessage.includes(ticketId)) {
      await replaced(ticketId, 'ticket_id_missing');
      return { summary: drafted.summary, userMessage: template.userMessage };
    }
    return drafted;
  }

  async function escalate(state: GraphState, withLlm: boolean): Promise<GraphUpdate> {
    const { ticketId } = state;
    const reason = escalationReason(state);
    const base: Omit<EscalationPackage, 'summary'> = {
      ticketId,
      category: state.category ?? 'unknown',
      ...(state.severity && { severity: state.severity }),
      ...(state.entities && { entities: state.entities as Entities }),
      findings: state.findings,
      reason,
      createdAt: clock().toISOString(),
    };
    const { summary, userMessage } = withLlm
      ? await texts(state, base)
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

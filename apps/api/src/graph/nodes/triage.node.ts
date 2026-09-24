import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { CATEGORIES } from 'agent-spec';
import { z } from 'zod';
import type { AuditLog } from '../../audit/audit-log.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import { CLASSIFY_TOOL } from '../../llm/fake-responder.js';
import { ISSUE_TYPES, LEVELS } from '../../tickets/ticket-state.js';
import type { SeverityMatrix } from '../severity-matrix.js';
import { mergeUpdate, toTicketState, type GraphState, type GraphUpdate } from '../state.js';

/** What the LLM decides in triage (design §5.1); severity is derived by the matrix, not the LLM. */
export const TriageOutput = z.object({
  category: z.enum(CATEGORIES),
  issueType: z.enum(ISSUE_TYPES),
  service: z.string().optional(),
  businessImpact: z.enum(LEVELS),
  urgency: z.enum(LEVELS),
  request: z
    .object({
      resource: z.string(),
      accessLevel: z.enum(['read', 'write', 'admin', 'license']),
      justification: z.string(),
    })
    .optional(),
});

export interface TriageNodeDeps {
  model: BaseChatModel;
  systemPrompt: string;
  severity: SeverityMatrix;
  audit: AuditLog;
  lifecycle: TicketLifecycle;
}

/**
 * The triage node (REQ-2.3-18..20): classifies the redacted text with the body of
 * `triage.agent.md` as system prompt, derives the severity from its matrix and moves the ticket
 * from NEW to TRIAGED.
 */
export function createTriageNode({
  model,
  systemPrompt,
  severity,
  audit,
  lifecycle,
}: TriageNodeDeps) {
  const classify = model.withStructuredOutput(TriageOutput, { name: CLASSIFY_TOOL });
  return async (state: GraphState): Promise<GraphUpdate> => {
    // The base structured output returns the raw tool arguments: validate them here.
    const output = TriageOutput.parse(
      await classify.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(state.redactedText),
      ]),
    );
    const derived = severity(output.businessImpact, output.urgency);
    const entities = {
      userRef: state.entities?.userRef ?? 'usr_unknown',
      ...(output.service && { service: output.service }),
      issueType: output.issueType,
      businessImpact: output.businessImpact,
      ...(output.request && { request: output.request }),
    };
    await audit.append({
      ticketId: state.ticketId,
      agent: 'triage',
      decision: 'classified',
      reason: `${output.category}/${output.issueType}, impact ${output.businessImpact} × urgency ${output.urgency}`,
      data: {
        category: output.category,
        issueType: output.issueType,
        severity: derived,
        businessImpact: output.businessImpact,
        urgency: output.urgency,
      },
    });
    const update = {
      category: output.category,
      severity: derived,
      urgency: output.urgency,
      entities,
    };
    const saved = await lifecycle.applyTransition(
      toTicketState(mergeUpdate(state, update)),
      'TRIAGED',
      {
        agent: 'triage',
        reason: `classified as ${output.category}/${output.issueType} with severity ${derived}`,
      },
    );
    return { ...update, status: saved.status };
  };
}

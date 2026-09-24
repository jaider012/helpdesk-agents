import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { OutputParserException } from '@langchain/core/output_parsers';
import { CATEGORIES } from 'agent-spec';
import { z } from 'zod';
import type { AuditLog } from '../../audit/audit-log.js';
import type { TicketLifecycle } from '../../tickets/ticket-lifecycle.js';
import { CLASSIFY_TOOL } from '../../llm/fake-responder.js';
import { entryPrompt } from '../../prompts/render.js';
import type { SlaPolicy } from '../../tickets/sla.js';
import { ISSUE_TYPES, LEVELS } from '../../tickets/ticket-state.js';
import type { SeverityMatrix } from '../severity-matrix.js';
import {
  mergeUpdate,
  toTicketState,
  type GraphState,
  type GraphUpdate,
  type LlmFailure,
} from '../state.js';

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
export type TriageOutput = z.infer<typeof TriageOutput>;

export interface TriageNodeDeps {
  model: BaseChatModel;
  systemPrompt: string;
  severity: SeverityMatrix;
  /** `slaDueAt` from the SLA table (REQ-2.1-14). */
  sla: SlaPolicy;
  audit: AuditLog;
  lifecycle: TicketLifecycle;
  /** Limit of the classification call (`LLM_TIMEOUT_MS`, REQ-ESC-04). */
  timeoutMs: number;
}

type Classification =
  | { ok: true; output: TriageOutput }
  | { ok: false; failure: LlmFailure; data: Record<string, unknown> };

/** A schema failure is `invalid_llm_output`; a timeout or any other error is `llm_unavailable`. */
function classifyFailure(error: unknown, signal: AbortSignal, timeoutMs: number): Classification {
  if (error instanceof z.ZodError) {
    const fields = [...new Set(error.issues.map((issue) => issue.path.join('.')))];
    return { ok: false, failure: 'invalid_llm_output', data: { fields } };
  }
  if (error instanceof OutputParserException) {
    return { ok: false, failure: 'invalid_llm_output', data: { fields: [] } };
  }
  return signal.aborted
    ? { ok: false, failure: 'llm_unavailable', data: { cause: 'timeout', timeoutMs } }
    : { ok: false, failure: 'llm_unavailable', data: { cause: 'error' } };
}

/**
 * The triage node (REQ-2.3-18..20): classifies the redacted text with the body of
 * `triage.agent.md` as system prompt, derives the severity from its matrix and moves the ticket
 * from NEW to TRIAGED. When the LLM call fails, times out or breaks the schema, the ticket stays in
 * NEW and the node reports the failure for R-X1/R-X2 (REQ-ESC-04, REQ-ESC-05).
 */
export function createTriageNode({
  model,
  systemPrompt,
  severity,
  sla,
  audit,
  lifecycle,
  timeoutMs,
}: TriageNodeDeps) {
  const classify = model.withStructuredOutput(TriageOutput, { name: CLASSIFY_TOOL });
  const classifyTicket = async (text: string): Promise<Classification> => {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const raw = await classify.invoke([new SystemMessage(systemPrompt), new HumanMessage(text)], {
        signal,
      });
      // The base structured output returns the raw tool arguments: validate them here.
      return { ok: true, output: TriageOutput.parse(raw) };
    } catch (error) {
      return classifyFailure(error, signal, timeoutMs);
    }
  };
  return async (state: GraphState): Promise<GraphUpdate> => {
    // In a prompt run, the rendered prompt file is the human message (design §7).
    const classification = await classifyTicket(entryPrompt(state, 'triage') ?? state.redactedText);
    if (!classification.ok) {
      await audit.append({
        ticketId: state.ticketId,
        agent: 'triage',
        decision: classification.failure,
        reason: `the classification call ended in ${classification.failure}`,
        data: classification.data,
      });
      return { llmFailure: classification.failure };
    }
    const { output } = classification;
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
      ...(state.createdAt && { slaDueAt: sla(derived, state.createdAt) }),
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

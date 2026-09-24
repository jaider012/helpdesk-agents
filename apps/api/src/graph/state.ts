import { Annotation } from '@langchain/langgraph';
import type {
  AgentName,
  Category,
  DiagnosticsOutcome,
  RouteDecision,
  Severity,
  TicketStatus,
} from 'agent-spec';
import type { AuditEntry } from '../audit/audit-entry.js';
import type { PromptRun } from '../prompts/render.js';
import type {
  Channel,
  DiagnosticFinding,
  Entities,
  EscalationPackage,
  ExecutedAction,
  Level,
  TicketState,
} from '../tickets/ticket-state.js';

const appended = <T>() =>
  Annotation<T[]>({ reducer: (current, update) => current.concat(update), default: () => [] });

/**
 * Graph state: the fields of TicketState (design §4), with `escalation` as `escalationPackage`.
 * findings, actions and audit only grow.
 */
export const TicketGraphState = Annotation.Root({
  ticketId: Annotation<string>(),
  // Transient: the raw ticket text, cleared by the redact node and never persisted (design §8.1).
  rawText: Annotation<string | undefined>(),
  channel: Annotation<Channel>(),
  createdAt: Annotation<string>(),
  redactedText: Annotation<string>(),
  category: Annotation<Category | undefined>(),
  severity: Annotation<Severity | undefined>(),
  urgency: Annotation<Level | undefined>(),
  // Partial until triage fills issueType and businessImpact after the redact node set userRef.
  entities: Annotation<Partial<Entities> | undefined>(),
  findings: appended<DiagnosticFinding>(),
  actions: appended<ExecutedAction>(),
  status: Annotation<TicketStatus>(),
  audit: appended<AuditEntry>(),
  entryAgent: Annotation<AgentName>(),
  nextAgent: Annotation<TicketState['nextAgent']>(),
  lastRoute: Annotation<RouteDecision | undefined>(),
  // Transient: the LLM failure the triage node routes on (R-X1, R-X2); never persisted (DC-51).
  llmFailure: Annotation<LlmFailure | undefined>(),
  // Transient: the outcome of the diagnostics procedure that R-D1..R-D8 route on (design §2.2).
  diagnosticsOutcome: Annotation<DiagnosticsOutcome | undefined>(),
  // Transient: the prompt file of an operator run, its variables redacted by the redact node.
  prompt: Annotation<PromptRun | undefined>(),
  // TicketState.escalation: LangGraph forbids a channel named like the `escalation` node (DC-42).
  escalationPackage: Annotation<EscalationPackage | undefined>(),
  userMessage: Annotation<string | undefined>(),
  slaDueAt: Annotation<string | undefined>(),
  closeReason: Annotation<TicketState['closeReason']>(),
});

export type LlmFailure = 'llm_unavailable' | 'invalid_llm_output';

export type GraphState = typeof TicketGraphState.State;
export type GraphUpdate = typeof TicketGraphState.Update;

/** The state after a node update, with the append reducers of findings, actions and audit. */
export function mergeUpdate(state: GraphState, update: GraphUpdate): GraphState {
  return {
    ...state,
    ...update,
    findings: [...state.findings, ...((update.findings as DiagnosticFinding[] | undefined) ?? [])],
    actions: [...state.actions, ...((update.actions as ExecutedAction[] | undefined) ?? [])],
    audit: [...state.audit, ...((update.audit as AuditEntry[] | undefined) ?? [])],
  } as GraphState;
}

/** The TicketState that the lifecycle validates and the ticket store persists (without rawText). */
export function toTicketState(state: GraphState): TicketState {
  const ticket: Record<string, unknown> = { ...state, escalation: state.escalationPackage };
  delete ticket.rawText;
  delete ticket.llmFailure;
  delete ticket.diagnosticsOutcome;
  delete ticket.prompt;
  delete ticket.escalationPackage;
  return ticket as unknown as TicketState;
}

/** The graph state of a stored ticket, the inverse of `toTicketState`. */
export function fromTicketState(ticket: TicketState): GraphState {
  const state: Record<string, unknown> = { ...ticket, escalationPackage: ticket.escalation };
  delete state.escalation;
  return state as unknown as GraphState;
}

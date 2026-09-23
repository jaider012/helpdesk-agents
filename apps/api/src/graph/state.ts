import { Annotation } from '@langchain/langgraph';
import type { AgentName, Category, RouteDecision, Severity, TicketStatus } from 'agent-spec';
import type { AuditEntry } from '../audit/audit-entry.js';
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
  channel: Annotation<Channel>(),
  createdAt: Annotation<string>(),
  redactedText: Annotation<string>(),
  category: Annotation<Category | undefined>(),
  severity: Annotation<Severity | undefined>(),
  urgency: Annotation<Level | undefined>(),
  entities: Annotation<Entities | undefined>(),
  findings: appended<DiagnosticFinding>(),
  actions: appended<ExecutedAction>(),
  status: Annotation<TicketStatus>(),
  audit: appended<AuditEntry>(),
  entryAgent: Annotation<AgentName>(),
  nextAgent: Annotation<TicketState['nextAgent']>(),
  lastRoute: Annotation<RouteDecision | undefined>(),
  // TicketState.escalation: LangGraph forbids a channel named like the `escalation` node (DC-42).
  escalationPackage: Annotation<EscalationPackage | undefined>(),
  userMessage: Annotation<string | undefined>(),
  slaDueAt: Annotation<string | undefined>(),
  closeReason: Annotation<TicketState['closeReason']>(),
});

export type GraphState = typeof TicketGraphState.State;
export type GraphUpdate = typeof TicketGraphState.Update;

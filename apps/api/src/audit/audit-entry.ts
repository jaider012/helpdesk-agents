import type { AgentName } from 'agent-spec';

export type AuditDecision =
  | 'ticket_created'
  | 'redacted'
  | 'prompt_run'
  | 'node_started'
  | 'node_finished'
  | 'classified'
  | 'routed'
  | 'transition'
  | 'transition_rejected'
  | 'tool_run'
  | 'skill_resource_unavailable'
  | 'action_executed'
  | 'action_rejected'
  | 'message_replaced'
  | 'escalated'
  | 'llm_unavailable'
  | 'invalid_llm_output'
  | 'error';

/** One line of `data/audit/<ticketId>.jsonl` (design §4). */
export interface AuditEntry {
  ts: string;
  ticketId: string;
  /** Monotonic per ticket, starting at 1. */
  seq: number;
  agent: AgentName | 'redact' | 'runtime' | 'operator';
  decision: AuditDecision;
  reason: string;
  /** Status in a `transition` entry, agent in a `routed` entry. */
  from?: string;
  to?: string;
  /** Ids, codes, durations and counts only; never ticket text. */
  data?: Record<string, unknown>;
}

/** What a caller appends; the audit log sets `ts` and `seq`. */
export type NewAuditEntry = Omit<AuditEntry, 'ts' | 'seq'>;

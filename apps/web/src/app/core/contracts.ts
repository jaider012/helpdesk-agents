// Data contracts of the api (specs/design.md §4 and §12.1). The api owns them; the web app only reads.

export type TicketStatus =
  'NEW' | 'TRIAGED' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
export type Category = 'access' | 'infra' | 'provisioning' | 'unknown';
export type Severity = 'P1' | 'P2' | 'P3' | 'P4';
export type Level = 'low' | 'medium' | 'high';
export type AgentName = 'triage' | 'diagnostics' | 'provisioning' | 'escalation';
export type Channel = 'email' | 'chat' | 'portal' | 'phone';

export type IssueType =
  | 'lockout'
  | 'password_reset'
  | 'mfa'
  | 'disabled_account'
  | 'vpn'
  | 'performance'
  | 'app'
  | 'folder_access'
  | 'repo_access'
  | 'license'
  | 'profile_change'
  | 'unknown';

export interface Entities {
  userRef: string;
  service?: string;
  issueType: IssueType;
  businessImpact: Level;
  request?: {
    resource: string;
    accessLevel: 'read' | 'write' | 'admin' | 'license';
    justification: string;
  };
}

export interface DiagnosticFinding {
  id: string;
  source: 'check-vpn' | 'rule';
  conclusive: boolean;
  cause?:
    | 'gateway_healthy'
    | 'dns_failure'
    | 'gateway_unreachable'
    | 'high_latency'
    | 'account_locked_by_retries'
    | 'resource_unavailable';
  checks?: Array<{
    name: 'dns' | 'tcp' | 'latency';
    status: 'pass' | 'fail' | 'skip';
    durationMs: number;
    reason?: string;
  }>;
  exitCode?: 0 | 1 | 2 | null;
  summary: string;
  durationMs: number;
  ts: string;
}

export interface ExecutedAction {
  id: 'instruct_vpn_reconnect' | 'instruct_self_service_unlock';
  kind: 'instruction' | 'automated';
  allowlisted: true;
  agent: AgentName;
  result: 'delivered' | 'succeeded' | 'failed';
  ts: string;
}

export type EscalationReason =
  | 'critical_severity'
  | 'unknown_category'
  | 'skill_resource_unavailable'
  | 'vpn_gateway_unhealthy'
  | 'requires_identity_action'
  | 'no_diagnostic_skill'
  | 'action_not_allowlisted'
  | 'approval_required'
  | 'llm_unavailable'
  | 'invalid_llm_output'
  | 'internal_error'
  | 'operator_request';

export interface ApprovalRequest {
  resource: string;
  accessLevel: string;
  requesterRef: string;
  justification: string;
  complete: boolean;
  summary: string;
}

export interface EscalationPackage {
  ticketId: string;
  category: Category;
  severity?: Severity;
  entities?: Entities;
  findings: DiagnosticFinding[];
  reason: EscalationReason;
  targetTeam?: string;
  approvalRequest?: ApprovalRequest;
  summary: string;
  createdAt: string;
}

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

export interface AuditEntry {
  ts: string;
  ticketId: string;
  seq: number;
  agent: AgentName | 'redact' | 'runtime' | 'operator';
  decision: AuditDecision;
  reason: string;
  from?: string;
  to?: string;
  data?: Record<string, unknown>;
}

export interface RouteDecision {
  from: AgentName | 'redact';
  to: AgentName | 'END';
  rule: string;
  reason?: EscalationReason;
}

export interface TicketState {
  ticketId: string;
  channel: Channel;
  createdAt: string;
  redactedText: string;
  category?: Category;
  severity?: Severity;
  urgency?: Level;
  entities?: Entities;
  findings: DiagnosticFinding[];
  actions: ExecutedAction[];
  status: TicketStatus;
  audit: AuditEntry[];
  entryAgent: AgentName;
  nextAgent?: 'diagnostics' | 'provisioning' | 'escalation';
  lastRoute?: RouteDecision;
  escalation?: EscalationPackage;
  userMessage?: string;
  slaDueAt?: string;
  closeReason?: 'user_confirmed' | 'no_user_reply' | 'handled_by_team';
}

/** `GET /tickets/:id`: the ticket state without its audit log. */
export type TicketDetail = Omit<TicketState, 'audit'>;

/** One row of `GET /tickets`. */
export type TicketSummary = Pick<
  TicketState,
  'ticketId' | 'category' | 'severity' | 'status' | 'slaDueAt'
>;

import type {
  AgentName,
  Category,
  EscalationReason,
  RouteDecision,
  Severity,
  TicketStatus,
} from 'agent-spec';
import type { AuditEntry } from '../audit/audit-entry.js';

// Data contracts of design §4.

export type Level = 'low' | 'medium' | 'high';
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

export interface AccessRequest {
  resource: string;
  accessLevel: 'read' | 'write' | 'admin' | 'license';
  justification: string;
}

export interface Entities {
  /** `usr_<8 hex>`, set by the redact node (REQ-SEC-05). */
  userRef: string;
  service?: string;
  issueType: IssueType;
  businessImpact: Level;
  /** Provisioning only: extracted by triage, normalized by provisioning. */
  request?: AccessRequest;
}

export interface DiagnosticFinding {
  /** `fnd_<n>` */
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
  /** `null` when the process was killed by the timeout. */
  exitCode?: 0 | 1 | 2 | null;
  /** Technical and internal; never shown to the user. */
  summary: string;
  durationMs: number;
  ts: string;
}

export interface ExecutedAction {
  id: 'instruct_vpn_reconnect' | 'instruct_self_service_unlock';
  kind: 'instruction' | 'automated';
  /** Only the action service sets it, after checking the allowlist. */
  allowlisted: true;
  agent: AgentName;
  result: 'delivered' | 'succeeded' | 'failed';
  ts: string;
}

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

export interface TicketState {
  /** `TCK-AAAAMMDD-HHMMSS-xxx` */
  ticketId: string;
  channel: Channel;
  createdAt: string;
  /** The only part of the ticket text that exists in the state. */
  redactedText: string;
  category?: Category;
  severity?: Severity;
  urgency?: Level;
  entities?: Entities;
  findings: DiagnosticFinding[];
  actions: ExecutedAction[];
  status: TicketStatus;
  /** Persisted as JSONL by the audit log. */
  audit: AuditEntry[];
  entryAgent: AgentName;
  nextAgent?: 'diagnostics' | 'provisioning' | 'escalation';
  lastRoute?: RouteDecision;
  escalation?: EscalationPackage;
  userMessage?: string;
  slaDueAt?: string;
  closeReason?: 'user_confirmed' | 'no_user_reply' | 'handled_by_team';
}

import { AuditEntry, TicketDetail } from '../app/core/contracts';

// Synthetic data only (CLAUDE.md §0): no real people, hosts or credentials.

export const TICKET_ID = 'TCK-20260923-101500-a1b';

export const TICKET: TicketDetail = {
  ticketId: TICKET_ID,
  channel: 'portal',
  createdAt: '2026-09-23T10:15:00.000Z',
  redactedText: 'No puedo conectarme a la VPN desde casa. Mi correo es [EMAIL].',
  category: 'infra',
  severity: 'P3',
  urgency: 'medium',
  entities: { userRef: 'usr_a1b2c3d4', issueType: 'vpn', businessImpact: 'medium' },
  findings: [],
  actions: [],
  status: 'IN_PROGRESS',
  entryAgent: 'triage',
  nextAgent: 'diagnostics',
  slaDueAt: '2026-09-24T10:15:00.000Z',
};

let seq = 0;

/** An audit entry of {@link TICKET_ID} with the next `seq`. */
export function entry(
  fields: Pick<AuditEntry, 'agent' | 'decision' | 'reason' | 'ts'> & Partial<AuditEntry>,
): AuditEntry {
  seq += 1;
  return { ticketId: TICKET_ID, seq, ...fields };
}

/** A run that went through redact and triage and is still diagnosing. */
export function runningAudit(): AuditEntry[] {
  seq = 0;
  return [
    entry({
      ts: '2026-09-23T10:15:00.000Z',
      agent: 'runtime',
      decision: 'ticket_created',
      reason: 'prompt_run',
    }),
    entry({
      ts: '2026-09-23T10:15:00.000Z',
      agent: 'redact',
      decision: 'node_started',
      reason: 'start',
    }),
    entry({
      ts: '2026-09-23T10:15:00.020Z',
      agent: 'redact',
      decision: 'redacted',
      reason: 'pii_found',
      data: { email: 1 },
    }),
    entry({
      ts: '2026-09-23T10:15:00.040Z',
      agent: 'redact',
      decision: 'node_finished',
      reason: 'done',
    }),
    entry({
      ts: '2026-09-23T10:15:00.041Z',
      agent: 'redact',
      decision: 'routed',
      reason: 'entry_agent',
      from: 'redact',
      to: 'triage',
    }),
    entry({
      ts: '2026-09-23T10:15:00.050Z',
      agent: 'triage',
      decision: 'node_started',
      reason: 'start',
    }),
    entry({
      ts: '2026-09-23T10:15:01.000Z',
      agent: 'triage',
      decision: 'classified',
      reason: 'infra/vpn',
    }),
    entry({
      ts: '2026-09-23T10:15:01.010Z',
      agent: 'triage',
      decision: 'transition',
      reason: 'classified',
      from: 'NEW',
      to: 'TRIAGED',
    }),
    entry({
      ts: '2026-09-23T10:15:01.020Z',
      agent: 'triage',
      decision: 'routed',
      reason: 'R-T1',
      from: 'triage',
      to: 'diagnostics',
    }),
    entry({
      ts: '2026-09-23T10:15:01.550Z',
      agent: 'triage',
      decision: 'node_finished',
      reason: 'done',
    }),
    entry({
      ts: '2026-09-23T10:15:01.560Z',
      agent: 'diagnostics',
      decision: 'node_started',
      reason: 'start',
    }),
    entry({
      ts: '2026-09-23T10:15:01.570Z',
      agent: 'diagnostics',
      decision: 'transition',
      reason: 'taken',
      from: 'TRIAGED',
      to: 'IN_PROGRESS',
    }),
    entry({
      ts: '2026-09-23T10:15:01.600Z',
      agent: 'diagnostics',
      decision: 'tool_run',
      reason: 'check-vpn: ok',
      data: { durationMs: 14 },
    }),
  ];
}

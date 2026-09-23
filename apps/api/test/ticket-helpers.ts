import type { TicketState } from '../src/tickets/ticket-state.js';

/** A synthetic ticket with every field that some transition may require. */
export function ticket(overrides: Partial<TicketState> = {}): TicketState {
  return {
    ticketId: 'TCK-20260923-101500-dem',
    channel: 'email',
    createdAt: '2026-09-23T10:15:00.000Z',
    redactedText: 'Desde esta mañana la VPN no me conecta. Mi correo es [EMAIL].',
    category: 'infra',
    severity: 'P3',
    urgency: 'medium',
    entities: {
      userRef: 'usr_a1b2c3d4',
      service: 'VPN corporativa',
      issueType: 'vpn',
      businessImpact: 'medium',
    },
    findings: [
      {
        id: 'fnd_1',
        source: 'check-vpn',
        conclusive: true,
        cause: 'gateway_healthy',
        summary: 'dns pass · tcp pass · latency pass (0.9 ms)',
        durationMs: 6,
        ts: '2026-09-23T10:16:00.000Z',
      },
    ],
    actions: [
      {
        id: 'instruct_vpn_reconnect',
        kind: 'instruction',
        allowlisted: true,
        agent: 'diagnostics',
        result: 'delivered',
        ts: '2026-09-23T10:16:01.000Z',
      },
    ],
    status: 'NEW',
    audit: [],
    entryAgent: 'triage',
    nextAgent: 'diagnostics',
    userMessage: 'Revisamos el servicio de conexión remota y está funcionando.',
    closeReason: 'user_confirmed',
    ...overrides,
  };
}

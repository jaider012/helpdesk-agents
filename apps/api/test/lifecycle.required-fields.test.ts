import { describe, expect, it } from 'vitest';
import { realStateMachine } from './lifecycle-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('lifecycle.required-fields', () => {
  it.each([
    [
      'NEW',
      'TRIAGED',
      {
        entities: {
          userRef: 'usr_a1b2c3d4',
          issueType: '' as never,
          businessImpact: 'medium' as const,
        },
      },
      'NEW → TRIAGED (T1) lacks entities.issueType',
    ],
    [
      'TRIAGED',
      'IN_PROGRESS',
      { nextAgent: undefined },
      'TRIAGED → IN_PROGRESS (T3) lacks nextAgent',
    ],
    [
      'IN_PROGRESS',
      'ESCALATED',
      { userMessage: '' },
      'IN_PROGRESS → ESCALATED (T7) lacks escalation.reason, userMessage',
    ],
    [
      'IN_PROGRESS',
      'WAITING_USER',
      { userMessage: undefined },
      'IN_PROGRESS → WAITING_USER (T6) lacks userMessage',
    ],
    [
      'WAITING_USER',
      'IN_PROGRESS',
      {
        entities: {
          userRef: 'usr_a1b2c3d4',
          issueType: 'unknown' as const,
          businessImpact: 'medium' as const,
        },
      },
      'WAITING_USER → IN_PROGRESS (T8) lacks entities.issueType!=unknown',
    ],
  ] as const)(
    'rejects %s → %s with MISSING_REQUIRED_FIELDS when a required field is empty',
    async (from, to, overrides, detail) => {
      const machine = await realStateMachine();

      expect(() => machine.validateTransition(ticket({ status: from, ...overrides }), to)).toThrow(
        expect.objectContaining({
          code: 'MISSING_REQUIRED_FIELDS',
          message: `MISSING_REQUIRED_FIELDS: ${detail}`,
        }),
      );
    },
  );

  it('accepts a transition whose required fields are all present', async () => {
    const machine = await realStateMachine();
    const escalated = ticket({
      status: 'IN_PROGRESS',
      escalation: {
        ticketId: 'TCK-20260923-101500-dem',
        category: 'infra',
        findings: [],
        reason: 'vpn_gateway_unhealthy',
        summary: 'Caso escalado.',
        createdAt: '2026-09-23T10:17:00.000Z',
      },
    });

    expect(machine.validateTransition(ticket({ status: 'NEW' }), 'TRIAGED').id).toBe('T1');
    expect(machine.validateTransition(escalated, 'ESCALATED').id).toBe('T7');
  });

  it('still rejects a transition absent from the table first', async () => {
    const machine = await realStateMachine();

    expect(() => machine.validateTransition(ticket({ status: 'NEW' }), 'RESOLVED')).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });
});

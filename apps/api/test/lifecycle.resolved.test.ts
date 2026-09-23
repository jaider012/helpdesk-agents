import { describe, expect, it } from 'vitest';
import { realStateMachine } from './lifecycle-helpers.js';
import type { TicketState } from '../src/tickets/ticket-state.js';
import { ticket } from './ticket-helpers.js';

describe('lifecycle.resolved', () => {
  it.each([
    [
      'without a conclusive finding',
      { findings: [{ ...ticket().findings[0], conclusive: false }] },
      'findings[conclusive]',
    ],
    ['without findings', { findings: [] }, 'findings[conclusive]'],
    ['without an allowlisted action', { actions: [] }, 'actions[allowlisted]'],
    ['with an empty userMessage', { userMessage: '' }, 'userMessage'],
  ] satisfies Array<[string, Partial<TicketState>, string]>)(
    'rejects IN_PROGRESS → RESOLVED %s with RESOLUTION_INCOMPLETE',
    async (_, overrides, missing) => {
      const machine = await realStateMachine();

      expect(() =>
        machine.validateTransition(ticket({ status: 'IN_PROGRESS', ...overrides }), 'RESOLVED'),
      ).toThrow(
        expect.objectContaining({
          code: 'RESOLUTION_INCOMPLETE',
          message: `RESOLUTION_INCOMPLETE: IN_PROGRESS → RESOLVED (T5) lacks ${missing}`,
        }),
      );
    },
  );

  it('accepts IN_PROGRESS → RESOLVED with a conclusive finding, an allowlisted action and a message', async () => {
    const machine = await realStateMachine();

    expect(machine.validateTransition(ticket({ status: 'IN_PROGRESS' }), 'RESOLVED').id).toBe('T5');
  });
});

import { TICKET_STATUSES } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import { realStateMachine } from './lifecycle-helpers.js';

describe('lifecycle.closed', () => {
  it.each(TICKET_STATUSES)('rejects CLOSED → %s with INVALID_TRANSITION', async (to) => {
    const machine = await realStateMachine();

    expect(machine.allowedFrom('CLOSED')).toEqual([]);
    expect(() => machine.assertTransition('CLOSED', to)).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });
});

import { TICKET_STATUSES } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import { TransitionError } from '../src/tickets/state-machine.js';
import { realStateMachine } from './lifecycle-helpers.js';

const ALLOWED = [
  'NEW→TRIAGED',
  'NEW→ESCALATED',
  'TRIAGED→IN_PROGRESS',
  'TRIAGED→ESCALATED',
  'IN_PROGRESS→RESOLVED',
  'IN_PROGRESS→WAITING_USER',
  'IN_PROGRESS→ESCALATED',
  'WAITING_USER→IN_PROGRESS',
  'WAITING_USER→ESCALATED',
  'WAITING_USER→CLOSED',
  'RESOLVED→CLOSED',
  'ESCALATED→CLOSED',
];

describe('lifecycle.invalid', () => {
  it('rejects NEW → RESOLVED with INVALID_TRANSITION and names the allowed targets', async () => {
    const machine = await realStateMachine();
    const error = (() => {
      try {
        machine.assertTransition('NEW', 'RESOLVED');
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(TransitionError);
    expect(error).toMatchObject({ code: 'INVALID_TRANSITION' });
    expect((error as Error).message).toBe(
      'INVALID_TRANSITION: NEW → RESOLVED is not in the transitions table; allowed from NEW: TRIAGED, ESCALATED',
    );
  });

  it('accepts exactly the 12 transitions of the table and rejects every other pair', async () => {
    const machine = await realStateMachine();
    const accepted = TICKET_STATUSES.flatMap((from) =>
      TICKET_STATUSES.filter((to) => {
        try {
          machine.assertTransition(from, to);
          return true;
        } catch {
          return false;
        }
      }).map((to) => `${from}→${to}`),
    );

    expect(accepted.sort()).toEqual([...ALLOWED].sort());
  });
});

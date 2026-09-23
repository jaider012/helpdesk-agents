import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { SpecModule } from '../src/spec/spec.module.js';
import { STATE_MACHINE, TicketsModule } from '../src/tickets/tickets.module.js';
import { TicketStateMachine } from '../src/tickets/state-machine.js';
import { fixtureStateMachine, realStateMachine, REPO_ROOT } from './lifecycle-helpers.js';

describe('lifecycle.compiled', () => {
  it('accepts a transition only because the table has a row for it (no hand-coded transitions)', async () => {
    const withExtraRow = await fixtureStateMachine('lifecycle-extra-row.md');
    const real = await realStateMachine();

    expect(withExtraRow.assertTransition('RESOLVED', 'IN_PROGRESS').id).toBe('T13');
    expect(() => real.assertTransition('RESOLVED', 'IN_PROGRESS')).toThrow(/INVALID_TRANSITION/);
  });

  it('builds the state machine from the real table when the runtime starts', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SpecModule.forRoot({ root: REPO_ROOT }), TicketsModule],
    }).compile();
    const machine = moduleRef.get<TicketStateMachine>(STATE_MACHINE);

    expect(machine.transitions.map(({ id }) => id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `T${index + 1}`),
    );
  });
});

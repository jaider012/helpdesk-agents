import { Module } from '@nestjs/common';
import type { SpecBundle } from 'agent-spec';
import { SPEC_BUNDLE } from '../spec/spec.module.js';
import { TicketStateMachine } from './state-machine.js';

/** Injection token of the ticket state machine compiled at startup. */
export const STATE_MACHINE = Symbol('STATE_MACHINE');

@Module({
  providers: [
    {
      provide: STATE_MACHINE,
      useFactory: (bundle: SpecBundle) => TicketStateMachine.fromBundle(bundle),
      inject: [SPEC_BUNDLE],
    },
  ],
  exports: [STATE_MACHINE],
})
export class TicketsModule {}

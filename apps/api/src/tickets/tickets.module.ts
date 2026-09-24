import { Module } from '@nestjs/common';
import type { SpecBundle } from 'agent-spec';
import { resolveDataDir } from '../paths.js';
import { SPEC_BUNDLE } from '../spec/spec.module.js';
import { TicketStateMachine } from './state-machine.js';
import { TicketStore } from './ticket-store.js';

/** Injection token of the ticket state machine compiled at startup. */
export const STATE_MACHINE = Symbol('STATE_MACHINE');
/** Injection token of the ticket store. */
export const TICKET_STORE = Symbol('TICKET_STORE');

@Module({
  providers: [
    {
      provide: STATE_MACHINE,
      useFactory: (bundle: SpecBundle) => TicketStateMachine.fromBundle(bundle),
      inject: [SPEC_BUNDLE],
    },
    { provide: TICKET_STORE, useFactory: () => new TicketStore(resolveDataDir(process.env)) },
  ],
  exports: [STATE_MACHINE, TICKET_STORE],
})
export class TicketsModule {}

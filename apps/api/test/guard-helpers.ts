import { loadSpec } from 'agent-spec';
import { guardFromBundle } from '../src/guards/user-message.guard.js';
import { fakeWithDraftedMessage } from './llm-failure-helpers.js';
import { REPO_ROOT } from './lifecycle-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

export const TICKET = 'TCK-20260923-101500-grd';

/** The guard compiled from the real copilot-instructions.md. */
export async function realGuard() {
  return guardFromBundle(await loadSpec(REPO_ROOT));
}

/** Escalates a ticket whose drafted user message is `message`; returns the run and its audit. */
export async function escalateWithMessage(message: (ticketId: string) => string) {
  const { graph, audit } = await runtime({ model: await fakeWithDraftedMessage(message) });
  const final = await graph.invoke(newTicket(TICKET, 'La impresora del piso 3 no imprime.'));
  const replaced = (await audit.read(TICKET)).find(
    ({ decision }) => decision === 'message_replaced',
  );
  return { final, replaced };
}

export const ESCALATED_TEMPLATE = `Tu caso ${TICKET} quedó asignado a un equipo especialista, que te contactará dentro del plazo de atención acordado.`;

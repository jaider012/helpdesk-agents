import { describe, expect, it } from 'vitest';
import { newTicket, runtime } from './runtime-helpers.js';

describe('escalation.status', () => {
  it('sets the ticket to ESCALATED, with the user message and the audit entries, and persists it', async () => {
    const { graph, audit, store } = await runtime();
    const ticketId = 'TCK-20260923-101500-sts';

    const final = await graph.invoke(newTicket(ticketId, 'La impresora del piso 3 no imprime.'));

    expect(final.status).toBe('ESCALATED');
    expect(final.userMessage).toBe(
      `Tu caso ${ticketId} quedó asignado a un equipo especialista, que te contactará dentro del plazo de atención acordado.`,
    );
    expect((await store.read(ticketId))?.status).toBe('ESCALATED');
    expect((await store.read(ticketId))?.escalation?.reason).toBe('unknown_category');
    expect(
      (await audit.read(ticketId)).map(({ decision, from, to }) => [decision, from, to]),
    ).toEqual([
      ['redacted', undefined, undefined],
      ['classified', undefined, undefined],
      ['transition', 'NEW', 'TRIAGED'],
      ['routed', 'triage', 'escalation'],
      ['escalated', undefined, undefined],
      ['transition', 'TRIAGED', 'ESCALATED'],
    ]);
  });
});

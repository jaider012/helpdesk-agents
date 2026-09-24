import { describe, expect, it } from 'vitest';
import { compileSla } from '../src/tickets/sla.js';
import { NOW, newTicket, runtime } from './runtime-helpers.js';

const HOURS = { P1: 4, P2: 8, P3: 24, P4: 72 } as const;
const plusHours = (iso: string, hours: number) =>
  new Date(Date.parse(iso) + hours * 3_600_000).toISOString();

describe('lifecycle.sla', () => {
  it('compiles the resolution target of each severity from the SLA table', () => {
    const due = compileSla(
      '## SLA\n\n| severidad | objetivo de resolución |\n| --- | --- |\n| P1 | 4 h |\n| P4 | 72 h |\n',
    );

    expect(due('P1', NOW)).toBe(plusHours(NOW, 4));
    expect(due('P4', NOW)).toBe(plusHours(NOW, 72));
    expect(() => due('P2', NOW)).toThrow(/P2/);
  });

  it.each([
    ['La VPN no me conecta.', 'TCK-20260923-101500-sl1'],
    [
      'Nadie en la sede puede entrar a la VPN, la operación está detenida.',
      'TCK-20260923-101500-sl2',
    ],
    [
      'Necesito acceso de lectura a la carpeta finanzas-2026 para el cierre.',
      'TCK-20260923-101500-sl3',
    ],
  ])('sets slaDueAt = createdAt + the target of the severity for «%s»', async (text, ticketId) => {
    const { graph, store } = await runtime();

    const final = await graph.invoke(newTicket(ticketId, text));

    const severity = final.severity as keyof typeof HOURS;
    expect(final.slaDueAt).toBe(plusHours(NOW, HOURS[severity]));
    expect((await store.read(ticketId))?.slaDueAt).toBe(final.slaDueAt);
  });
});

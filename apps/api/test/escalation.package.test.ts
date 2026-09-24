import { describe, expect, it } from 'vitest';
import { newTicket, NOW, runtime } from './runtime-helpers.js';

describe('escalation.package', () => {
  it('builds the package with ticketId, category, severity, entities, findings and reason', async () => {
    const { graph } = await runtime();

    const final = await graph.invoke(
      newTicket(
        'TCK-20260923-101500-p1a',
        'Nadie en la sede puede entrar a la intranet y la facturación está detenida.',
      ),
    );

    expect(final.escalationPackage).toEqual({
      ticketId: 'TCK-20260923-101500-p1a',
      category: 'unknown',
      severity: 'P1',
      entities: { userRef: 'usr_unknown', issueType: 'unknown', businessImpact: 'high' },
      findings: [],
      reason: 'critical_severity',
      summary: 'Caso TCK-20260923-101500-p1a escalado. Consulta los hallazgos adjuntos.',
      createdAt: NOW,
    });
  });

  it('takes the reason of the routing decision that led to escalation', async () => {
    const { graph } = await runtime();

    const final = await graph.invoke(
      newTicket('TCK-20260923-101500-unk', 'La impresora del piso 3 no imprime.'),
    );

    expect(final.escalationPackage).toMatchObject({
      category: 'unknown',
      severity: 'P3',
      reason: 'unknown_category',
    });
  });
});

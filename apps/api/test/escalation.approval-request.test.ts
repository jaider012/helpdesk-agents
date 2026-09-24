import { describe, expect, it } from 'vitest';
import type { GraphState } from '../src/graph/state.js';
import { SALT } from './triage-helpers.js';
import { userRefFor } from '../src/redact/redact-node.js';
import { newTicket, runtime } from './runtime-helpers.js';

// Stands in for the provisioning node (T-55): routes to escalation by R-P1.
const approvalRequired = (state: GraphState) => ({
  lastRoute: {
    from: 'provisioning' as const,
    to: 'escalation' as const,
    rule: 'R-P1',
    reason: 'approval_required' as const,
  },
  entities: state.entities,
});

describe('escalation.approval-request', () => {
  it('derives approvalRequest from entities.request and entities.userRef for a provisioning ticket', async () => {
    const { graph } = await runtime({ override: { provisioning: approvalRequired } });
    const ticketId = 'TCK-20260923-101500-apr';

    const final = await graph.invoke(
      newTicket(
        ticketId,
        'Soy ana.demo@example.com. Necesito acceso de lectura a la carpeta finanzas-2026 para preparar el cierre del mes.',
      ),
    );

    expect(final.escalationPackage).toMatchObject({
      reason: 'approval_required',
      approvalRequest: {
        resource: 'carpeta finanzas-2026',
        accessLevel: 'read',
        requesterRef: userRefFor('ana.demo@example.com', SALT),
        justification: 'preparar el cierre del mes',
        complete: true,
        summary: `Solicitud de acceso del caso ${ticketId} pendiente de aprobación.`,
      },
    });
  });

  it('marks the approval request as incomplete when the request lacks a field', async () => {
    const { graph } = await runtime({ override: { provisioning: approvalRequired } });

    const final = await graph.invoke(
      newTicket(
        'TCK-20260923-101500-inc',
        'Necesito acceso de lectura a la carpeta finanzas-2026.',
      ),
    );

    expect(final.escalationPackage?.approvalRequest).toMatchObject({
      justification: '',
      complete: false,
    });
  });

  it('leaves approvalRequest out of the package of any other category', async () => {
    const { graph } = await runtime();

    const final = await graph.invoke(
      newTicket('TCK-20260923-101500-nap', 'La impresora del piso 3 no imprime.'),
    );

    expect(final.escalationPackage).not.toHaveProperty('approvalRequest');
  });
});

import { describe, expect, it } from 'vitest';
import { CLASSIFY_TOOL } from '../src/llm/fake-responder.js';
import { fakeWithClassify } from './llm-failure-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

const classifyAs = (issueType: string, request?: Record<string, unknown>) =>
  fakeWithClassify(() => ({
    toolCall: {
      name: CLASSIFY_TOOL,
      args: {
        category: 'provisioning',
        issueType,
        businessImpact: 'low',
        urgency: 'medium',
        ...(request && { request }),
      },
    },
  }));

describe('provisioning.request', () => {
  it('normalizes entities.request, records it and sends the ticket to approval', async () => {
    const { graph, audit, store } = await runtime();
    const ticketId = 'TCK-20260923-101500-pr1';

    const final = await graph.invoke(
      newTicket(
        ticketId,
        'Necesito acceso de lectura a la carpeta finanzas-2026 para preparar el cierre del mes.',
      ),
    );

    const request = {
      resource: 'carpeta finanzas-2026',
      accessLevel: 'read',
      justification: 'preparar el cierre del mes',
    };
    expect(final.entities?.request).toEqual(request);
    expect(final.lastRoute).toEqual({
      from: 'provisioning',
      to: 'escalation',
      rule: 'R-P1',
      reason: 'approval_required',
    });
    const entries = await audit.read(ticketId);
    expect(entries.find(({ decision }) => decision === 'node_finished')).toMatchObject({
      agent: 'provisioning',
      data: { resource: 'carpeta finanzas-2026', accessLevel: 'read' },
    });
    expect(
      entries
        .filter(({ decision }) => decision === 'transition')
        .map(({ from, to }) => `${from}→${to}`),
    ).toEqual(['NEW→TRIAGED', 'TRIAGED→IN_PROGRESS', 'IN_PROGRESS→ESCALATED']);
    expect((await store.read(ticketId))?.entities?.request).toEqual(request);
  });

  it('trims the fields and keeps exactly resource, accessLevel and justification', async () => {
    const model = await classifyAs('repo_access', {
      resource: '  repositorio   pagos-api ',
      accessLevel: 'write',
      justification: '  el despliegue   del viernes ',
    });
    const { graph } = await runtime({ model });

    const final = await graph.invoke(newTicket('TCK-20260923-101500-pr2', 'Necesito acceso.'));

    expect(final.entities?.request).toEqual({
      resource: 'repositorio pagos-api',
      accessLevel: 'write',
      justification: 'el despliegue del viernes',
    });
  });

  it('falls back to read and empty fields when triage extracted no request', async () => {
    const { graph } = await runtime({ model: await classifyAs('folder_access') });

    const final = await graph.invoke(newTicket('TCK-20260923-101500-pr3', 'Necesito acceso.'));

    expect(final.entities?.request).toEqual({
      resource: '',
      accessLevel: 'read',
      justification: '',
    });
    expect(final.escalationPackage?.approvalRequest?.complete).toBe(false);
  });

  it('uses the license level for a license request', async () => {
    const model = await classifyAs('license', {
      resource: 'licencia de diseño',
      accessLevel: 'read',
      justification: 'el nuevo proyecto',
    });
    const { graph } = await runtime({ model });

    const final = await graph.invoke(newTicket('TCK-20260923-101500-pr4', 'Necesito licencia.'));

    expect(final.entities?.request?.accessLevel).toBe('license');
  });
});

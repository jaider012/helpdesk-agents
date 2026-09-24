import { describe, expect, it } from 'vitest';
import { newTicket, runtime } from './runtime-helpers.js';

describe('graph.vpn-route', () => {
  it('applies the vpn-diagnostics skill to an infra ticket about the VPN', async () => {
    const { graph, audit } = await runtime();
    const ticketId = 'TCK-20260923-101500-vr1';

    await graph.invoke(newTicket(ticketId, 'La VPN no me conecta desde esta mañana.'));

    const entries = await audit.read(ticketId);
    expect(entries.find(({ decision }) => decision === 'routed')).toMatchObject({
      from: 'triage',
      to: 'diagnostics',
    });
    expect(entries.find(({ decision }) => decision === 'tool_run')).toMatchObject({
      agent: 'diagnostics',
      data: { tool: 'execute/runInTerminal', skill: 'vpn-diagnostics' },
    });
  });

  it('does not run the skill for an access ticket that touches identity', async () => {
    const { graph, audit } = await runtime();
    const ticketId = 'TCK-20260923-101500-vr2';

    const final = await graph.invoke(
      newTicket(ticketId, 'Cambié de celular y ya no tengo el autenticador.'),
    );

    const entries = await audit.read(ticketId);
    expect(entries.map(({ decision }) => decision)).not.toContain('tool_run');
    expect(final.escalationPackage?.reason).toBe('requires_identity_action');
  });
});

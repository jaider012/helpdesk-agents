import { describe, expect, it } from 'vitest';
import { newTicket, runtime } from './runtime-helpers.js';
import { closedPort } from './skill-helpers.js';

describe('graph.vpn-unhealthy', () => {
  it('hands off to escalation with vpn_gateway_unhealthy when check-vpn exits with code 1', async () => {
    const { graph, audit } = await runtime({ vpnTarget: `localhost:${await closedPort()}` });
    const ticketId = 'TCK-20260923-101500-vun';

    const final = await graph.invoke(newTicket(ticketId, 'La VPN no me conecta.'));

    expect(final.status).toBe('ESCALATED');
    expect(final.actions).toEqual([]);
    expect(final.findings).toMatchObject([
      { source: 'check-vpn', conclusive: true, cause: 'gateway_unreachable', exitCode: 1 },
    ]);
    expect(final.lastRoute).toEqual({
      from: 'diagnostics',
      to: 'escalation',
      rule: 'R-D4',
      reason: 'vpn_gateway_unhealthy',
    });
    expect(final.escalationPackage).toMatchObject({
      reason: 'vpn_gateway_unhealthy',
      findings: [{ cause: 'gateway_unreachable' }],
    });
    const transitions = (await audit.read(ticketId))
      .filter(({ decision }) => decision === 'transition')
      .map(({ from, to }) => `${from}→${to}`);
    expect(transitions).toEqual(['NEW→TRIAGED', 'TRIAGED→IN_PROGRESS', 'IN_PROGRESS→ESCALATED']);
  });
});

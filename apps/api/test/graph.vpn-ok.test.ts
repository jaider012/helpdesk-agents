import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NOW, newTicket, runtime } from './runtime-helpers.js';
import { startTcpServer } from './skill-helpers.js';

describe('graph.vpn-ok', () => {
  let server: Awaited<ReturnType<typeof startTcpServer>>;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('executes instruct_vpn_reconnect and resolves the ticket when check-vpn exits with code 0', async () => {
    const { graph, audit, store } = await runtime({ vpnTarget: `localhost:${server.port}` });
    const ticketId = 'TCK-20260923-101500-vok';

    const final = await graph.invoke(newTicket(ticketId, 'La VPN no me conecta.'));

    expect(final.status).toBe('RESOLVED');
    expect(final.findings).toMatchObject([
      { id: 'fnd_1', source: 'check-vpn', conclusive: true, cause: 'gateway_healthy', exitCode: 0 },
    ]);
    expect(final.actions).toEqual([
      {
        id: 'instruct_vpn_reconnect',
        kind: 'instruction',
        allowlisted: true,
        agent: 'diagnostics',
        result: 'delivered',
        ts: NOW,
      },
    ]);
    expect(final.userMessage).toBe(
      `Revisamos el servicio de conexión remota y está funcionando. Cierra por completo la aplicación de VPN, vuelve a abrirla e inicia sesión. Si el problema sigue, responde citando el caso ${ticketId}.`,
    );
    expect(final.lastRoute).toEqual({ from: 'diagnostics', to: 'END', rule: 'R-D1' });
    expect((await store.read(ticketId))?.status).toBe('RESOLVED');
    const transitions = (await audit.read(ticketId))
      .filter(({ decision }) => decision === 'transition')
      .map(({ from, to }) => `${from}→${to}`);
    expect(transitions).toEqual(['NEW→TRIAGED', 'TRIAGED→IN_PROGRESS', 'IN_PROGRESS→RESOLVED']);
  });
});

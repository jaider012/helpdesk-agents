import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  findCheck,
  parseOutput,
  runCheckVpn,
  startTcpServer,
  type LocalTcpServer,
} from './helpers.js';

describe('check-vpn.latency', () => {
  let server: LocalTcpServer;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('reports the connection latency in milliseconds', async () => {
    const output = parseOutput(await runCheckVpn(['--target', `localhost:${server.port}`]));
    const latency = findCheck(output, 'latency');

    expect(latency.status).toBe('pass');
    expect(latency.durationMs).toBeGreaterThanOrEqual(0);
    expect(latency.durationMs).toBeLessThan(1000);
    expect(output.summary).toContain(`latency pass (${latency.durationMs} ms)`);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseOutput, runCheckVpn, startTcpServer, type LocalTcpServer } from './helpers.js';

describe('check-vpn.exit0', () => {
  let server: LocalTcpServer;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('reports every check as pass and exits with code 0', async () => {
    const run = await runCheckVpn(['--target', `localhost:${server.port}`]);
    const output = parseOutput(run);

    expect(run.code).toBe(0);
    expect(output).toMatchObject({
      ok: true,
      target: { host: 'localhost', port: server.port },
      error: null,
    });
    expect(output.checks.map((check) => [check.name, check.status])).toEqual([
      ['dns', 'pass'],
      ['tcp', 'pass'],
      ['latency', 'pass'],
    ]);
  });
});

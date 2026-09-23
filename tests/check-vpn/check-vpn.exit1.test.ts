import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closedPort,
  parseOutput,
  runCheckVpn,
  startTcpServer,
  type LocalTcpServer,
} from './helpers.js';

describe('check-vpn.exit1', () => {
  let server: LocalTcpServer;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('exits with code 1 when the latency exceeds the threshold', async () => {
    const run = await runCheckVpn([
      '--target',
      `localhost:${server.port}`,
      '--latency-threshold-ms',
      '0',
    ]);

    expect(run.code).toBe(1);
    expect(parseOutput(run)).toMatchObject({ ok: false, error: null });
  });

  it('exits with code 1 when the port is closed', async () => {
    const run = await runCheckVpn(['--target', `localhost:${await closedPort()}`]);

    expect(run.code).toBe(1);
    expect(parseOutput(run)).toMatchObject({ ok: false, error: null });
  });

  it('exits with code 1 when the host does not resolve', async () => {
    const run = await runCheckVpn(['--target', 'vpn-gw.example.invalid:443']);

    expect(run.code).toBe(1);
    expect(parseOutput(run)).toMatchObject({ ok: false, error: null });
  });
});

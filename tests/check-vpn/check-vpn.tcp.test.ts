import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closedPort,
  findCheck,
  parseOutput,
  runCheckVpn,
  startTcpServer,
  type LocalTcpServer,
} from './helpers.js';

describe('check-vpn.tcp', () => {
  let server: LocalTcpServer;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('opens a TCP connection to host:port', async () => {
    const output = parseOutput(await runCheckVpn(['--target', `localhost:${server.port}`]));

    expect(findCheck(output, 'tcp')).toMatchObject({ status: 'pass' });
    expect(server.connectionCount()).toBe(1);
  });

  it('marks tcp as fail and skips latency when the port is closed', async () => {
    const output = parseOutput(await runCheckVpn(['--target', `localhost:${await closedPort()}`]));

    expect(findCheck(output, 'tcp')).toMatchObject({ status: 'fail', reason: 'ECONNREFUSED' });
    expect(findCheck(output, 'latency')).toMatchObject({ status: 'skip', reason: 'tcp_failed' });
    expect(output.ok).toBe(false);
  });
});

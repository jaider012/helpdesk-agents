import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  findCheck,
  parseOutput,
  runCheckVpn,
  startTcpServer,
  type LocalTcpServer,
} from './helpers.js';

describe('check-vpn.dns', () => {
  let server: LocalTcpServer;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('resolves the target host through DNS', async () => {
    const output = parseOutput(await runCheckVpn(['--target', `localhost:${server.port}`]));

    expect(findCheck(output, 'dns')).toMatchObject({ status: 'pass' });
  });

  it('marks dns as fail and skips tcp and latency when the host does not resolve', async () => {
    const output = parseOutput(await runCheckVpn(['--target', 'vpn-gw.example.invalid:443']));

    expect(findCheck(output, 'dns')).toMatchObject({ status: 'fail', reason: expect.any(String) });
    expect(findCheck(output, 'tcp')).toMatchObject({ status: 'skip', reason: 'dns_failed' });
    expect(findCheck(output, 'latency')).toMatchObject({ status: 'skip', reason: 'dns_failed' });
    expect(output.ok).toBe(false);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  findCheck,
  parseOutput,
  runCheckVpn,
  startTcpServer,
  type LocalTcpServer,
} from './helpers.js';

describe('check-vpn.threshold', () => {
  let server: LocalTcpServer;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  const target = () => ['--target', `localhost:${server.port}`];

  it('marks latency as fail when it exceeds --latency-threshold-ms', async () => {
    const output = parseOutput(await runCheckVpn([...target(), '--latency-threshold-ms', '0']));
    const latency = findCheck(output, 'latency');

    expect(latency).toMatchObject({ status: 'fail', reason: 'threshold_exceeded' });
    expect(latency.durationMs).toBeGreaterThan(0);
    expect(output.summary).toContain(`latency fail (threshold_exceeded, ${latency.durationMs} ms)`);
  });

  it('keeps latency as pass when it is within --latency-threshold-ms', async () => {
    const output = parseOutput(await runCheckVpn([...target(), '--latency-threshold-ms', '1000']));

    expect(findCheck(output, 'latency').status).toBe('pass');
  });

  it.each(['-1', 'fast', '1.5'])(
    'rejects --latency-threshold-ms %s as invalid arguments',
    async (value) => {
      const run = await runCheckVpn([...target(), '--latency-threshold-ms', value]);

      expect(run.code).toBe(2);
      expect(parseOutput(run).error).toMatchObject({ code: 'INVALID_ARGS' });
    },
  );
});

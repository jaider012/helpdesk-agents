import { describe, expect, it } from 'vitest';
import { findCheck, parseOutput, runCheckVpn, SLOW_DNS, SLOW_TCP } from './helpers.js';

describe('check-vpn.check-timeout', () => {
  it('marks dns as fail with reason timeout and skips tcp and latency', async () => {
    const run = await runCheckVpn(
      ['--target', 'vpn-gw.example.internal:443', '--timeout-ms', '200'],
      { preload: SLOW_DNS },
    );
    const output = parseOutput(run);

    expect(run.code).toBe(1);
    expect(findCheck(output, 'dns')).toMatchObject({ status: 'fail', reason: 'timeout' });
    expect(findCheck(output, 'tcp')).toMatchObject({ status: 'skip', reason: 'dns_failed' });
    expect(findCheck(output, 'latency')).toMatchObject({ status: 'skip', reason: 'dns_failed' });
  });

  it('marks tcp as fail with reason timeout and skips latency', async () => {
    const run = await runCheckVpn(['--target', 'localhost:443', '--timeout-ms', '200'], {
      preload: SLOW_TCP,
    });
    const output = parseOutput(run);

    expect(run.code).toBe(1);
    expect(findCheck(output, 'tcp')).toMatchObject({ status: 'fail', reason: 'timeout' });
    expect(findCheck(output, 'latency')).toMatchObject({ status: 'skip', reason: 'tcp_failed' });
  });

  it('exits right after printing while the timed-out DNS lookup is still pending', async () => {
    const run = await runCheckVpn(
      ['--target', 'vpn-gw.example.internal:443', '--timeout-ms', '200'],
      { preload: SLOW_DNS },
    );

    expect(findCheck(parseOutput(run), 'dns').reason).toBe('timeout');
    expect(run.durationMs).toBeLessThan(3000);
  }, 10_000);
});

import { describe, expect, it } from 'vitest';
import { findCheck, parseOutput, runCheckVpn, SLOW_DNS, SLOW_TCP } from './helpers.js';

// Node schedules timers on a whole-millisecond loop clock, so a timer can fire up to 1 ms before
// performance.now() shows the full delay.
const TIMER_RESOLUTION_MS = 1;

describe('check-vpn.timeout-arg', () => {
  it('applies --timeout-ms as the timeout of the DNS check', async () => {
    const run = await runCheckVpn(
      ['--target', 'vpn-gw.example.internal:443', '--timeout-ms', '200'],
      { preload: SLOW_DNS },
    );
    const dns = findCheck(parseOutput(run), 'dns');

    expect(dns).toMatchObject({ status: 'fail', reason: 'timeout' });
    expect(dns.durationMs).toBeGreaterThanOrEqual(200 - TIMER_RESOLUTION_MS);
    expect(dns.durationMs).toBeLessThan(1000);
  });

  it('applies --timeout-ms as the timeout of the TCP check', async () => {
    const run = await runCheckVpn(['--target', 'localhost:443', '--timeout-ms', '200'], {
      preload: SLOW_TCP,
    });
    const tcp = findCheck(parseOutput(run), 'tcp');

    expect(tcp).toMatchObject({ status: 'fail', reason: 'timeout' });
    expect(tcp.durationMs).toBeGreaterThanOrEqual(200 - TIMER_RESOLUTION_MS);
    expect(tcp.durationMs).toBeLessThan(1000);
  });

  it('uses 3000 ms per check when --timeout-ms is absent', { timeout: 10_000 }, async () => {
    const run = await runCheckVpn(['--target', 'vpn-gw.example.internal:443'], {
      preload: SLOW_DNS,
    });
    const dns = findCheck(parseOutput(run), 'dns');

    expect(dns).toMatchObject({ status: 'fail', reason: 'timeout' });
    expect(dns.durationMs).toBeGreaterThanOrEqual(3000 - TIMER_RESOLUTION_MS);
    expect(dns.durationMs).toBeLessThan(4000);
  });

  it.each(['0', '-5', 'soon'])('rejects --timeout-ms %s as invalid arguments', async (value) => {
    const run = await runCheckVpn(['--target', 'localhost:443', '--timeout-ms', value]);

    expect(run.code).toBe(2);
    expect(parseOutput(run).error).toMatchObject({ code: 'INVALID_ARGS' });
  });
});

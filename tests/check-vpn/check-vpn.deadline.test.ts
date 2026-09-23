import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOutput, runCheckVpn, SCRIPT_PATH, SLOW_DNS, SLOW_TCP } from './helpers.js';

describe('check-vpn.deadline', () => {
  it('exits with code 2 and DEADLINE_EXCEEDED when the total execution exceeds --deadline-ms', async () => {
    const run = await runCheckVpn(
      ['--target', 'localhost:443', '--timeout-ms', '5000', '--deadline-ms', '300'],
      { preload: SLOW_TCP },
    );
    const output = parseOutput(run);

    expect(run.code).toBe(2);
    expect(output).toMatchObject({ ok: false, error: { code: 'DEADLINE_EXCEEDED' } });
    expect(output).toHaveProperty('summary', expect.stringContaining('DEADLINE_EXCEEDED'));
    expect(run.durationMs).toBeLessThan(3000);
  });

  it('keeps the checks that finished before the deadline', async () => {
    const tcpPending = parseOutput(
      await runCheckVpn(
        ['--target', 'localhost:443', '--timeout-ms', '5000', '--deadline-ms', '300'],
        { preload: SLOW_TCP },
      ),
    );
    const dnsPending = parseOutput(
      await runCheckVpn(
        ['--target', 'vpn-gw.example.internal:443', '--timeout-ms', '5000', '--deadline-ms', '300'],
        { preload: SLOW_DNS },
      ),
    );

    expect(tcpPending.checks.map((check) => [check.name, check.status])).toEqual([['dns', 'pass']]);
    expect(dnsPending.checks).toEqual([]);
  });

  it('defines DEFAULT_DEADLINE_MS = 9000, below the 10 s timeout of the skill', () => {
    const source = readFileSync(SCRIPT_PATH, 'utf8');

    expect(/^const DEFAULT_DEADLINE_MS = (\d+);$/m.exec(source)?.[1]).toBe('9000');
  });

  it.each(['9001', '0', '-1', 'later'])(
    'rejects --deadline-ms %s as invalid arguments',
    async (value) => {
      const run = await runCheckVpn(['--target', 'localhost:443', '--deadline-ms', value]);

      expect(run.code).toBe(2);
      expect(parseOutput(run).error).toMatchObject({ code: 'INVALID_ARGS' });
    },
  );
});

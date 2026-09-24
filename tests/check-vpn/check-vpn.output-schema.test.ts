import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closedPort,
  runCheckVpn,
  SLOW_TCP,
  startTcpServer,
  type CheckVpnRun,
  type LocalTcpServer,
} from './helpers.js';

const OUTPUT_KEYS = ['version', 'ok', 'target', 'checks', 'summary', 'error', 'durationMs'];
const CHECK_KEYS = ['name', 'status', 'durationMs', 'reason'];
const ERROR_CODES = ['INVALID_ARGS', 'INTERNAL', 'DEADLINE_EXCEEDED'];

describe('check-vpn.output-schema', () => {
  let server: LocalTcpServer;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  const scenarios: Array<[string, () => Promise<CheckVpnRun>]> = [
    ['every check passes', () => runCheckVpn(['--target', `localhost:${server.port}`])],
    ['a check fails', async () => runCheckVpn(['--target', `localhost:${await closedPort()}`])],
    ['the arguments are invalid', () => runCheckVpn([])],
    [
      'the deadline expires',
      () =>
        runCheckVpn(['--target', 'localhost:443', '--deadline-ms', '200'], { preload: SLOW_TCP }),
    ],
  ];

  it.each(scenarios)(
    'prints exactly one JSON object with the stable keys when %s',
    async (_, execute) => {
      const run = await execute();

      expect(run.stderr).toBe('');
      expect(run.stdout.endsWith('\n')).toBe(true);
      expect(run.stdout.trimEnd().split('\n')).toHaveLength(1);
      const output = JSON.parse(run.stdout);
      expect(Object.keys(output).sort()).toEqual([...OUTPUT_KEYS].sort());
      expect(output).toMatchObject({
        version: 1,
        ok: expect.any(Boolean),
        checks: expect.any(Array),
        summary: expect.any(String),
        durationMs: expect.any(Number),
      });
      expect(output.target === null || typeof output.target.port === 'number').toBe(true);
      for (const check of output.checks) {
        expect(CHECK_KEYS).toEqual(expect.arrayContaining(Object.keys(check)));
        expect(['dns', 'tcp', 'latency']).toContain(check.name);
        expect(['pass', 'fail', 'skip']).toContain(check.status);
      }
      if (output.error !== null) {
        expect(ERROR_CODES).toContain(output.error.code);
        expect(output.error.message).toEqual(expect.any(String));
      }
    },
  );
});

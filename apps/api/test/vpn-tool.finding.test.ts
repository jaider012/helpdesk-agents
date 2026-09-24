import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CheckVpnTool, vpnCheckFrom } from '../src/tools/check-vpn-tool.js';
import { SkillRunner, type ScriptRun } from '../src/tools/skill-runner.js';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';
import { checkVpnScript, startTcpServer } from './skill-helpers.js';

const NOW = '2026-09-23T10:15:00.000Z';
const meta = { findingId: 'fnd_2', ts: NOW };

/** A finished run whose stdout carries these checks. */
function runWith(exitCode: 0 | 1, checks: Array<[string, 'pass' | 'fail' | 'skip']>): ScriptRun {
  const output = {
    ok: exitCode === 0,
    checks: checks.map(([name, status]) => ({ name, status, durationMs: 5 })),
    summary: checks.map(([name, status]) => `${name} ${status}`).join(' · '),
  };
  const stdout = JSON.stringify(output);
  return { exitCode, signal: null, timedOut: false, stdout, stderr: '', durationMs: 42 };
}

describe('vpn-tool.finding', () => {
  let server: Awaited<ReturnType<typeof startTcpServer>>;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('builds a conclusive gateway_healthy finding from a real exit 0 run', async () => {
    const { log } = await tempAuditLog();
    const tool = new CheckVpnTool(
      new SkillRunner(log),
      await checkVpnScript(),
      log,
      () => new Date(NOW),
    );

    const { finding, outcome } = await tool.run(`localhost:${server.port}`, {
      ticketId: TICKET_ID,
      findingId: 'fnd_1',
    });

    expect(outcome).toBe('vpn_ok');
    expect(finding).toMatchObject({
      id: 'fnd_1',
      source: 'check-vpn',
      conclusive: true,
      cause: 'gateway_healthy',
      exitCode: 0,
      ts: NOW,
    });
    expect(finding.checks?.map(({ name, status }) => [name, status])).toEqual([
      ['dns', 'pass'],
      ['tcp', 'pass'],
      ['latency', 'pass'],
    ]);
    expect(finding.summary).toContain('dns pass');
  });

  it.each([
    [
      'dns_failure',
      [
        ['dns', 'fail'],
        ['tcp', 'skip'],
        ['latency', 'skip'],
      ],
    ],
    [
      'gateway_unreachable',
      [
        ['dns', 'pass'],
        ['tcp', 'fail'],
        ['latency', 'skip'],
      ],
    ],
    [
      'high_latency',
      [
        ['dns', 'pass'],
        ['tcp', 'pass'],
        ['latency', 'fail'],
      ],
    ],
  ] as Array<[string, Array<[string, 'pass' | 'fail' | 'skip']>]>)(
    'reads exit code 1 as vpn_unhealthy with cause %s from the first failed check',
    (cause, checks) => {
      const { finding, outcome } = vpnCheckFrom(runWith(1, checks), meta);

      expect(outcome).toBe('vpn_unhealthy');
      expect(finding).toMatchObject({ conclusive: true, cause, exitCode: 1, durationMs: 42 });
    },
  );
});

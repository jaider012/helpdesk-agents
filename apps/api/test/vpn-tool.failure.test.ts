import { resolveRoute } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import { CheckVpnTool } from '../src/tools/check-vpn-tool.js';
import { SkillRunner, type SkillScript } from '../src/tools/skill-runner.js';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';
import { BLOCKING_SCRIPT, TEXT_SCRIPT, checkVpnScript } from './skill-helpers.js';

const NOW = '2026-09-23T10:15:00.000Z';

async function checkWith(script: Partial<SkillScript>, target = 'vpn-gw.example.internal:443') {
  const { log } = await tempAuditLog();
  const tool = new CheckVpnTool(
    new SkillRunner(log),
    { ...(await checkVpnScript()), ...script },
    log,
    () => new Date(NOW),
  );
  const result = await tool.run(target, { ticketId: TICKET_ID, findingId: 'fnd_1' });
  return { result, entries: await log.read(TICKET_ID) };
}

describe('vpn-tool.failure', () => {
  it.each([
    ['times out', { path: BLOCKING_SCRIPT, timeoutMs: 300 }, undefined, null],
    ['exits with code 2', {}, 'no-port', 2],
    ['prints text instead of JSON', { path: TEXT_SCRIPT }, undefined, 0],
    ['is missing (node exits 1 without JSON)', { path: '/nonexistent/check-vpn.js' }, undefined, 1],
  ])(
    'routes to escalation with skill_resource_unavailable when the script %s',
    async (_, script, target, exitCode) => {
      const { result, entries } = await checkWith(script, target);

      expect(result.outcome).toBe('resource_unavailable');
      expect(result.finding).toMatchObject({
        id: 'fnd_1',
        source: 'check-vpn',
        conclusive: false,
        cause: 'resource_unavailable',
        exitCode,
        ts: NOW,
      });
      expect(resolveRoute('diagnostics', { kind: 'outcome', outcome: result.outcome })).toEqual({
        from: 'diagnostics',
        to: 'escalation',
        rule: 'R-D5',
        reason: 'skill_resource_unavailable',
      });
      const entry = entries.find(({ decision }) => decision === 'skill_resource_unavailable');
      expect(entry).toMatchObject({ agent: 'diagnostics', data: { exitCode } });
      expect(entry?.data?.durationMs).toBe(Math.round(result.finding.durationMs));
    },
  );
});

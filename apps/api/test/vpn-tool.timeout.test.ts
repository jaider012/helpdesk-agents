import { describe, expect, it } from 'vitest';
import { SkillRunner } from '../src/tools/skill-runner.js';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';
import { BLOCKING_SCRIPT, checkVpnScript } from './skill-helpers.js';

describe('vpn-tool.timeout', () => {
  it('kills the process with SIGKILL when it runs longer than the timeout of the skill', async () => {
    const { log } = await tempAuditLog();
    const script = { ...(await checkVpnScript()), path: BLOCKING_SCRIPT, timeoutMs: 300 };

    const run = await new SkillRunner(log).run(script, [], {
      ticketId: TICKET_ID,
      agent: 'diagnostics',
    });

    expect(run).toMatchObject({ exitCode: null, signal: 'SIGKILL', timedOut: true });
    expect(run.durationMs).toBeGreaterThanOrEqual(300);
    expect(run.durationMs).toBeLessThan(5_000);
  });
});

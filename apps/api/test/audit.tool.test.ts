import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SkillRunner } from '../src/tools/skill-runner.js';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';
import { BLOCKING_SCRIPT, checkVpnScript, startTcpServer } from './skill-helpers.js';

const context = { ticketId: TICKET_ID, agent: 'diagnostics' as const };

describe('audit.tool', () => {
  let server: Awaited<ReturnType<typeof startTcpServer>>;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('records the tool name, the result status and the duration of each run', async () => {
    const { log } = await tempAuditLog();

    const run = await new SkillRunner(log).run(
      await checkVpnScript(),
      ['--target', `localhost:${server.port}`],
      context,
    );

    const entries = await log.read(TICKET_ID);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      agent: 'diagnostics',
      decision: 'tool_run',
      data: {
        tool: 'execute/runInTerminal',
        skill: 'vpn-diagnostics',
        script: 'scripts/check-vpn.js',
        status: 'ok',
        exitCode: 0,
        durationMs: Math.round(run.durationMs),
      },
    });
  });

  it('records the timeout status and a null exit code when the runtime kills the process', async () => {
    const { log } = await tempAuditLog();
    const script = { ...(await checkVpnScript()), path: BLOCKING_SCRIPT, timeoutMs: 300 };

    await new SkillRunner(log).run(script, [], context);

    expect((await log.read(TICKET_ID))[0]?.data).toMatchObject({
      status: 'timeout',
      exitCode: null,
    });
  });
});

import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SkillRunner } from '../src/tools/skill-runner.js';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';
import { REPO_ROOT } from './lifecycle-helpers.js';
import { checkVpnScript, startTcpServer } from './skill-helpers.js';

describe('vpn-tool.run', () => {
  let server: Awaited<ReturnType<typeof startTcpServer>>;
  beforeAll(async () => (server = await startTcpServer()));
  afterAll(() => server.close());

  it('compiles check-vpn.js with the path of the SKILL.md link and its 10 s timeout', async () => {
    expect(await checkVpnScript()).toEqual({
      skill: 'vpn-diagnostics',
      script: 'scripts/check-vpn.js',
      path: join(REPO_ROOT, '.github/skills/vpn-diagnostics/scripts/check-vpn.js'),
      timeoutMs: 10_000,
    });
  });

  it('runs check-vpn.js as a child process and returns its exit code and stdout', async () => {
    const { log } = await tempAuditLog();
    const runner = new SkillRunner(log);

    const run = await runner.run(await checkVpnScript(), ['--target', `localhost:${server.port}`], {
      ticketId: TICKET_ID,
      agent: 'diagnostics',
    });

    expect(run).toMatchObject({ exitCode: 0, signal: null, timedOut: false });
    expect(JSON.parse(run.stdout)).toMatchObject({ ok: true, target: { port: server.port } });
  });
});

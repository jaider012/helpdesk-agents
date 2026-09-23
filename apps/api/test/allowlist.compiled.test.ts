import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpecModule } from '../src/spec/spec.module.js';
import { ACTION_SERVICE, ToolsModule } from '../src/tools/tools.module.js';
import type { ActionService } from '../src/tools/actions.js';
import { fixtureActionService, realActionService, tempAudit } from './action-helpers.js';
import { REPO_ROOT } from './lifecycle-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('allowlist.compiled', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts an action only because the allowlist table lists it (no hand-coded actions)', async () => {
    const audit = await tempAudit();
    const withExtraAction = await fixtureActionService('allowlist-extra-action.md', audit);
    const real = await realActionService(audit);
    const inProgress = ticket({ status: 'IN_PROGRESS' });

    await expect(
      withExtraAction.execute(inProgress, 'instruct_restart_app', 'diagnostics'),
    ).resolves.toMatchObject({
      id: 'instruct_restart_app',
    });
    await expect(real.execute(inProgress, 'instruct_restart_app', 'diagnostics')).rejects.toThrow(
      expect.objectContaining({ code: 'ACTION_NOT_ALLOWLISTED' }),
    );
  });

  it('loads the allowlist of diagnostics.agent.md when the runtime starts', async () => {
    vi.stubEnv('DATA_DIR', (await import('node:os')).tmpdir());
    const moduleRef = await Test.createTestingModule({
      imports: [SpecModule.forRoot({ root: REPO_ROOT }), ToolsModule],
    }).compile();

    expect(moduleRef.get<ActionService>(ACTION_SERVICE).allowlistedIds).toEqual([
      'instruct_vpn_reconnect',
      'instruct_self_service_unlock',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

const DIAGNOSTICS = '.github/agents/diagnostics.agent.md';

describe('allowlist.unsafe', () => {
  it('reports UNSAFE_ALLOWLIST_ACTION for an action tagged mfa, credentials or permissions', async () => {
    expect(await errorsWithCode('allowlist-unsafe', 'UNSAFE_ALLOWLIST_ACTION')).toEqual([
      {
        code: 'UNSAFE_ALLOWLIST_ACTION',
        path: DIAGNOSTICS,
        message: 'allowlist action `reset_mfa` is tagged `mfa`',
      },
      {
        code: 'UNSAFE_ALLOWLIST_ACTION',
        path: DIAGNOSTICS,
        message: 'allowlist action `grant_folder` is tagged `permissions`',
      },
    ]);
  });

  it('accepts the real remediation allowlist', async () => {
    expect(await errorsWithCode(REPO_ROOT, 'UNSAFE_ALLOWLIST_ACTION')).toEqual([]);
  });
});

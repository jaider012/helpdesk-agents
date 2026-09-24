import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('graph.allowed-handoffs', () => {
  it('reports HANDOFF_NOT_ALLOWED for a handoff absent from the agent policy', async () => {
    expect(await errorsWithCode('graph-handoff-not-allowed', 'HANDOFF_NOT_ALLOWED')).toEqual([
      {
        code: 'HANDOFF_NOT_ALLOWED',
        path: '.github/agents/diagnostics.agent.md',
        message: 'policy.ts does not allow the handoff `diagnostics` → `provisioning`',
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])('accepts the handoffs of policy.ts (%s)', async (root) => {
    expect(await errorsWithCode(root, 'HANDOFF_NOT_ALLOWED')).toEqual([]);
  });
});

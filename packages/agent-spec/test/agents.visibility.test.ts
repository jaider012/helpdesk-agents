import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('agents.visibility', () => {
  it('reports AGENT_VISIBILITY_INVALID when the visibility differs from policy.ts', async () => {
    expect(await errorsWithCode('agents-visibility', 'AGENT_VISIBILITY_INVALID')).toEqual([
      {
        code: 'AGENT_VISIBILITY_INVALID',
        path: '.github/agents/diagnostics.agent.md',
        message: '`user-invocable` is false but policy.ts requires true',
      },
      {
        code: 'AGENT_VISIBILITY_INVALID',
        path: '.github/agents/helper.agent.md',
        message: 'agent `helper` is not in policy.ts',
      },
      {
        code: 'AGENT_VISIBILITY_INVALID',
        path: '.github/agents/provisioning.agent.md',
        message: '`disable-model-invocation` is false but policy.ts requires true',
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])('accepts the visibility of policy.ts (%s)', async (root) => {
    expect(await errorsWithCode(root, 'AGENT_VISIBILITY_INVALID')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('agents.tool-permissions', () => {
  it('reports TOOL_NOT_PERMITTED for a registry tool outside the permitted set of the agent', async () => {
    expect(await errorsWithCode('agents-tool-not-permitted', 'TOOL_NOT_PERMITTED')).toEqual([
      {
        code: 'TOOL_NOT_PERMITTED',
        path: '.github/agents/provisioning.agent.md',
        message: 'policy.ts does not permit the tool `execute/runInTerminal` for `provisioning`',
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])('accepts the tools of policy.ts (%s)', async (root) => {
    expect(await errorsWithCode(root, 'TOOL_NOT_PERMITTED')).toEqual([]);
  });
});

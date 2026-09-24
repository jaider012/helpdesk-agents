import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('agents.unknown-tool', () => {
  it('reports UNKNOWN_TOOL, and not TOOL_NOT_PERMITTED, for a tool absent from the registry', async () => {
    expect(await errorsWithCode('agents-unknown-tool', 'UNKNOWN_TOOL')).toEqual([
      {
        code: 'UNKNOWN_TOOL',
        path: '.github/agents/triage.agent.md',
        message: 'tool `web/fetch` is not in the tool registry',
      },
    ]);
    expect(await errorsWithCode('agents-unknown-tool', 'TOOL_NOT_PERMITTED')).toEqual([]);
  });

  it.each(['agents-valid', REPO_ROOT])('accepts registry tools (%s)', async (root) => {
    expect(await errorsWithCode(root, 'UNKNOWN_TOOL')).toEqual([]);
  });
});

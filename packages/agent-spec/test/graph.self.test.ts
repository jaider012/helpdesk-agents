import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('graph.self', () => {
  it('reports SELF_HANDOFF, and not HANDOFF_CYCLE, for a handoff to itself', async () => {
    expect(await errorsWithCode('graph-self', 'HANDOFF_CYCLE')).toEqual([]);
    expect(await errorsWithCode('graph-self', 'SELF_HANDOFF')).toEqual([
      {
        code: 'SELF_HANDOFF',
        path: '.github/agents/diagnostics.agent.md',
        message: '`diagnostics` hands off to itself',
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])(
    'accepts a handoff graph without this defect (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'SELF_HANDOFF')).toEqual([]);
    },
  );
});

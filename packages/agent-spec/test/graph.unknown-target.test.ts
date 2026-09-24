import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('graph.unknown-target', () => {
  it('reports UNKNOWN_HANDOFF_TARGET', async () => {
    expect(await errorsWithCode('graph-unknown-target', 'UNKNOWN_HANDOFF_TARGET')).toEqual([
      {
        code: 'UNKNOWN_HANDOFF_TARGET',
        path: '.github/agents/triage.agent.md',
        message: 'handoff target `reviewer` has no .agent.md file',
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])(
    'accepts a handoff graph without this defect (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'UNKNOWN_HANDOFF_TARGET')).toEqual([]);
    },
  );
});

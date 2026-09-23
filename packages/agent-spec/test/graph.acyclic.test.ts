import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('graph.acyclic', () => {
  it('reports HANDOFF_CYCLE', async () => {
    expect(await errorsWithCode('graph-cycle', 'HANDOFF_CYCLE')).toEqual([
      {
        code: 'HANDOFF_CYCLE',
        path: '.github/agents/diagnostics.agent.md',
        message: 'handoff cycle `diagnostics` → `triage` → `diagnostics`',
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])(
    'accepts a handoff graph without this defect (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'HANDOFF_CYCLE')).toEqual([]);
    },
  );
});

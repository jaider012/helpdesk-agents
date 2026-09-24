import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('graph.terminal', () => {
  it('reports TERMINAL_HAS_HANDOFFS', async () => {
    expect(await errorsWithCode('graph-terminal', 'TERMINAL_HAS_HANDOFFS')).toEqual([
      {
        code: 'TERMINAL_HAS_HANDOFFS',
        path: '.github/agents/escalation.agent.md',
        message: 'the terminal agent `escalation` declares 1 handoff',
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])(
    'accepts a handoff graph without this defect (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'TERMINAL_HAS_HANDOFFS')).toEqual([]);
    },
  );
});

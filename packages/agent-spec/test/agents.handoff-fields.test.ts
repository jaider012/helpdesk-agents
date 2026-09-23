import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

const TRIAGE = '.github/agents/triage.agent.md';

describe('agents.handoff-fields', () => {
  it('reports HANDOFF_INVALID for a handoff without label, agent, prompt or send', async () => {
    expect(await errorsWithCode('agents-handoff-fields', 'HANDOFF_INVALID')).toEqual([
      {
        code: 'HANDOFF_INVALID',
        path: TRIAGE,
        message: '`handoffs[0].send` must be true or false',
      },
      {
        code: 'HANDOFF_INVALID',
        path: TRIAGE,
        message: '`handoffs[1].prompt` must be a non-empty text',
      },
      {
        code: 'HANDOFF_INVALID',
        path: TRIAGE,
        message: '`handoffs[2]` must be a mapping with `label`, `agent`, `prompt` and `send`',
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])('accepts complete handoffs (%s)', async (root) => {
    expect(await errorsWithCode(root, 'HANDOFF_INVALID')).toEqual([]);
  });
});

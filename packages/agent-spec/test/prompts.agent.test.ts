import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('prompts.agent', () => {
  it('reports UNKNOWN_PROMPT_AGENT when agent matches no .agent.md file', async () => {
    expect(await errorsWithCode('prompts-agent', 'UNKNOWN_PROMPT_AGENT')).toEqual([
      {
        code: 'UNKNOWN_PROMPT_AGENT',
        path: '.github/prompts/escalate-ticket.prompt.md',
        message: 'agent `reviewer` has no .agent.md file',
      },
    ]);
  });

  it.each(['prompts-valid', REPO_ROOT])(
    'accepts an agent with its .agent.md (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'UNKNOWN_PROMPT_AGENT')).toEqual([]);
    },
  );
});

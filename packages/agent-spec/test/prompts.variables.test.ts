import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('prompts.variables', () => {
  it('reports PROMPT_VARIABLE_MISSING for each required ${input:*} variable absent from the body', async () => {
    expect(await errorsWithCode('prompts-variables', 'PROMPT_VARIABLE_MISSING')).toEqual([
      {
        code: 'PROMPT_VARIABLE_MISSING',
        path: '.github/prompts/escalate-ticket.prompt.md',
        message: 'the body lacks the variable `${input:reason}`',
      },
      {
        code: 'PROMPT_VARIABLE_MISSING',
        path: '.github/prompts/triage-ticket.prompt.md',
        message: 'the body lacks the variable `${input:channel}`',
      },
    ]);
  });

  it.each(['prompts-valid', REPO_ROOT])(
    'accepts the variables with or without placeholder (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'PROMPT_VARIABLE_MISSING')).toEqual([]);
    },
  );
});

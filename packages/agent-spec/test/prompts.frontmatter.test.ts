import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

const PROMPT = '.github/prompts/triage-ticket.prompt.md';

describe('prompts.frontmatter', () => {
  it('reports PROMPT_FRONTMATTER_INVALID when agent or tools is missing', async () => {
    expect(await errorsWithCode('prompts-frontmatter', 'PROMPT_FRONTMATTER_INVALID')).toEqual([
      {
        code: 'PROMPT_FRONTMATTER_INVALID',
        path: PROMPT,
        message: '`agent` must be a non-empty text',
      },
      {
        code: 'PROMPT_FRONTMATTER_INVALID',
        path: PROMPT,
        message: '`tools` must be a list of tool names',
      },
    ]);
  });

  it.each(['prompts-valid', REPO_ROOT])(
    'accepts a prompt with agent and tools (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'PROMPT_FRONTMATTER_INVALID')).toEqual([]);
    },
  );
});

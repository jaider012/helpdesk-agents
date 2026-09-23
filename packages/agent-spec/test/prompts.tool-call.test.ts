import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('prompts.tool-call', () => {
  it('reports PROMPT_WITHOUT_TOOL_CALL for a body without a #tool: reference', async () => {
    expect(await errorsWithCode('prompts-tool-call', 'PROMPT_WITHOUT_TOOL_CALL')).toEqual([
      {
        code: 'PROMPT_WITHOUT_TOOL_CALL',
        path: '.github/prompts/triage-ticket.prompt.md',
        message: 'the body has no `#tool:<name>` reference',
      },
    ]);
  });

  it('reports PROMPT_TOOL_UNDECLARED for a #tool: reference absent from the prompt tools', async () => {
    expect(await errorsWithCode('prompts-tool-call', 'PROMPT_TOOL_UNDECLARED')).toEqual([
      {
        code: 'PROMPT_TOOL_UNDECLARED',
        path: '.github/prompts/quick-note.prompt.md',
        message: '`#tool:execute/runInTerminal` is not in the `tools` of the prompt',
      },
    ]);
  });

  it.each(['prompts-valid', REPO_ROOT])('accepts declared tool references (%s)', async (root) => {
    expect(await errorsWithCode(root, 'PROMPT_WITHOUT_TOOL_CALL')).toEqual([]);
    expect(await errorsWithCode(root, 'PROMPT_TOOL_UNDECLARED')).toEqual([]);
  });
});

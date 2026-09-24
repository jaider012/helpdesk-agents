import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('agents.frontmatter', () => {
  it('reports AGENT_FRONTMATTER_INVALID for a missing description or tools and for a wrong type', async () => {
    expect(await errorsWithCode('agents-frontmatter-missing', 'AGENT_FRONTMATTER_INVALID')).toEqual(
      [
        {
          code: 'AGENT_FRONTMATTER_INVALID',
          path: '.github/agents/escalation.agent.md',
          message: '`description` must be a non-empty text',
        },
        {
          code: 'AGENT_FRONTMATTER_INVALID',
          path: '.github/agents/escalation.agent.md',
          message: '`user-invocable` must be true or false',
        },
        {
          code: 'AGENT_FRONTMATTER_INVALID',
          path: '.github/agents/triage.agent.md',
          message: '`tools` must be a list of tool names',
        },
      ],
    );
  });

  it.each(['agents-valid', REPO_ROOT])('accepts complete agent frontmatters (%s)', async (root) => {
    expect(await errorsWithCode(root, 'AGENT_FRONTMATTER_INVALID')).toEqual([]);
  });
});

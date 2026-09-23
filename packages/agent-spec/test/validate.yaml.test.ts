import { describe, expect, it } from 'vitest';
import { loadSpec, validateSpec } from '../src/index.ts';
import { fixture } from './helpers.ts';

describe('validate.yaml', () => {
  it('reports FRONTMATTER_PARSE_ERROR for each frontmatter that is not a valid YAML mapping', async () => {
    const errors = validateSpec(await loadSpec(fixture('yaml-invalid'))).filter(
      (error) => error.code === 'FRONTMATTER_PARSE_ERROR',
    );

    expect(errors.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: 'FRONTMATTER_PARSE_ERROR', path: '.github/agents/triage.agent.md' },
      {
        code: 'FRONTMATTER_PARSE_ERROR',
        path: '.github/instructions/ticket-lifecycle.instructions.md',
      },
      { code: 'FRONTMATTER_PARSE_ERROR', path: '.github/prompts/triage-ticket.prompt.md' },
    ]);
    expect(errors.every((error) => error.message.length > 0)).toBe(true);
  });
});

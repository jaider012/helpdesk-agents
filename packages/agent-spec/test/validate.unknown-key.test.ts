import { describe, expect, it } from 'vitest';
import { loadSpec, validateSpec } from '../src/index.js';
import { fixture } from './helpers.js';

describe('validate.unknown-key', () => {
  it('reports UNKNOWN_FRONTMATTER_KEY for each key outside the Annex A set of its file type', async () => {
    const errors = validateSpec(await loadSpec(fixture('unknown-key')));

    expect(errors).toEqual([
      {
        code: 'UNKNOWN_FRONTMATTER_KEY',
        path: '.github/agents/triage.agent.md',
        message: 'unknown frontmatter key `infer`',
      },
      {
        code: 'UNKNOWN_FRONTMATTER_KEY',
        path: '.github/agents/triage.agent.md',
        message: 'unknown frontmatter key `color`',
      },
      {
        code: 'UNKNOWN_FRONTMATTER_KEY',
        path: '.github/agents/triage.agent.md',
        message: 'unknown frontmatter key `handoffs[0].condition`',
      },
      {
        code: 'UNKNOWN_FRONTMATTER_KEY',
        path: '.github/instructions/ticket-lifecycle.instructions.md',
        message: 'unknown frontmatter key `priority`',
      },
      {
        code: 'UNKNOWN_FRONTMATTER_KEY',
        path: '.github/prompts/triage-ticket.prompt.md',
        message: 'unknown frontmatter key `mode`',
      },
      {
        code: 'UNKNOWN_FRONTMATTER_KEY',
        path: '.github/skills/vpn-diagnostics/SKILL.md',
        message: 'unknown frontmatter key `version`',
      },
    ]);
  });
});

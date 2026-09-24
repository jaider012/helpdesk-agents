import { describe, expect, it } from 'vitest';
import { REPO_ROOT, runCli } from './cli.ts';
import { fixture } from './helpers.ts';

describe('validate.output', () => {
  it('prints one line per error with the code and the path of the offending file', () => {
    const lines = runCli(fixture('unknown-key')).stdout.trimEnd().split('\n');

    expect(lines).toContain(
      'UNKNOWN_FRONTMATTER_KEY .github/agents/triage.agent.md: unknown frontmatter key `infer`',
    );
    expect(lines).toContain(
      'REQUIRED_FILE_MISSING .github/prompts/escalate-ticket.prompt.md: required file is missing',
    );
    expect(lines.at(-1)).toMatch(/^spec:validate: \d+ errors?$/);
  });

  it('prints a single OK line when the spec has no errors', () => {
    expect(runCli(REPO_ROOT).stdout).toBe('spec:validate: OK\n');
  });
});

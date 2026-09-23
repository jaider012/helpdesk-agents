import { describe, expect, it } from 'vitest';
import { REPO_ROOT, runCli } from './cli.ts';
import { fixture } from './helpers.ts';

describe('validate.exit-code', () => {
  it('exits with code 1 when the spec has at least one error', () => {
    expect(runCli(fixture('required-missing')).code).toBe(1);
  });

  it('exits with code 0 when the spec has no errors', () => {
    expect(runCli(REPO_ROOT).code).toBe(0);
  });
});

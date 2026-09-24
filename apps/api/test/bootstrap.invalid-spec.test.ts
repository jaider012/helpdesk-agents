import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { SPEC_BUNDLE, SpecModule } from '../src/spec/spec.module.js';

const INVALID_SPEC = fileURLToPath(new URL('./fixtures/invalid-spec', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

describe('bootstrap.invalid-spec', () => {
  it('aborts startup with the list of validation errors when the .github/ spec is invalid', async () => {
    const startup = Test.createTestingModule({
      imports: [SpecModule.forRoot({ root: INVALID_SPEC })],
    }).compile();
    const error: Error = await startup.then(
      () => new Error('startup did not abort'),
      (reason: Error) => reason,
    );

    expect(error.message).toMatch(/^spec validation failed with \d+ errors:/);
    expect(error.message).toContain(
      'UNKNOWN_FRONTMATTER_KEY .github/agents/triage.agent.md: unknown frontmatter key `infer`',
    );
    expect(error.message).toContain(
      'REQUIRED_FILE_MISSING .github/copilot-instructions.md: required file is missing',
    );
  });

  it('starts with the validated spec bundle when the .github/ spec is valid', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SpecModule.forRoot({ root: REPO_ROOT })],
    }).compile();

    expect(moduleRef.get(SPEC_BUNDLE).files.map(({ kind }: { kind: string }) => kind)).toContain(
      'agent',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('skill.steps', () => {
  it('reports SKILL_STEPS_MISSING when the body has no numbered procedure', async () => {
    expect(await errorsWithCode('skill-steps-missing', 'SKILL_STEPS_MISSING')).toEqual([
      {
        code: 'SKILL_STEPS_MISSING',
        path: '.github/skills/vpn-diagnostics/SKILL.md',
        message: 'the body has no numbered procedure (at least 2 numbered steps)',
      },
    ]);
  });

  it.each(['skill-body-valid', REPO_ROOT])('accepts a numbered procedure (%s)', async (root) => {
    expect(await errorsWithCode(root, 'SKILL_STEPS_MISSING')).toEqual([]);
  });
});

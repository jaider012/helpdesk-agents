import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('skill.description', () => {
  it('reports SKILL_DESCRIPTION_TOO_LONG for a description over 1024 characters', async () => {
    expect(await errorsWithCode('skill-description-long', 'SKILL_DESCRIPTION_TOO_LONG')).toEqual([
      {
        code: 'SKILL_DESCRIPTION_TOO_LONG',
        path: '.github/skills/vpn-diagnostics/SKILL.md',
        message: '`description` has 1025 characters (maximum 1024)',
      },
    ]);
  });

  it.each(['skill-valid', REPO_ROOT])(
    'accepts a description up to 1024 characters (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'SKILL_DESCRIPTION_TOO_LONG')).toEqual([]);
    },
  );

  it('reports one code per broken rule of the same SKILL.md', async () => {
    const codes = await Promise.all(
      (
        ['SKILL_NAME_MISMATCH', 'SKILL_DESCRIPTION_TOO_LONG', 'SKILL_ACTIVATION_MISSING'] as const
      ).map(async (code) => (await errorsWithCode('skill-three-rules', code)).length),
    );

    expect(codes).toEqual([1, 1, 1]);
  });
});

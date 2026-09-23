import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('skill.name', () => {
  it('reports SKILL_NAME_MISMATCH when name differs from the skill folder', async () => {
    expect(await errorsWithCode('skill-name-mismatch', 'SKILL_NAME_MISMATCH')).toEqual([
      {
        code: 'SKILL_NAME_MISMATCH',
        path: '.github/skills/vpn-diagnostics/SKILL.md',
        message: '`name` is `vpn-check` but the folder is `vpn-diagnostics`',
      },
    ]);
  });

  it.each(['skill-valid', REPO_ROOT])('accepts a name equal to its folder (%s)', async (root) => {
    expect(await errorsWithCode(root, 'SKILL_NAME_MISMATCH')).toEqual([]);
  });
});

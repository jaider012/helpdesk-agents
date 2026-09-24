import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('skill.frontmatter', () => {
  it('reports SKILL_FRONTMATTER_INVALID when name or description is missing', async () => {
    expect(await errorsWithCode('skill-missing-description', 'SKILL_FRONTMATTER_INVALID')).toEqual([
      {
        code: 'SKILL_FRONTMATTER_INVALID',
        path: '.github/skills/vpn-diagnostics/SKILL.md',
        message: 'SKILL.md needs a text `name` and a text `description`',
      },
    ]);
  });

  it('reports SKILL_FRONTMATTER_INVALID when name is not lowercase letters, digits and hyphens', async () => {
    expect(await errorsWithCode('skill-bad-name', 'SKILL_FRONTMATTER_INVALID')).toEqual([
      {
        code: 'SKILL_FRONTMATTER_INVALID',
        path: '.github/skills/VPN_Diag/SKILL.md',
        message: '`name` must be 1-64 lowercase letters, digits or hyphens',
      },
    ]);
  });

  it.each(['skill-valid', REPO_ROOT])('accepts a complete frontmatter (%s)', async (root) => {
    expect(await errorsWithCode(root, 'SKILL_FRONTMATTER_INVALID')).toEqual([]);
  });
});

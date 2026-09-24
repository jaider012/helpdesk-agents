import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('skill.resource', () => {
  it('reports SKILL_RESOURCE_UNLINKED when the body does not link a script of the skill', async () => {
    expect(await errorsWithCode('skill-resource-unlinked', 'SKILL_RESOURCE_UNLINKED')).toEqual([
      {
        code: 'SKILL_RESOURCE_UNLINKED',
        path: '.github/skills/vpn-diagnostics/SKILL.md',
        message: 'the body has no relative link to `scripts/check-vpn.js`',
      },
    ]);
  });

  it.each(['skill-body-valid', REPO_ROOT])(
    'accepts a relative link to each script (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'SKILL_RESOURCE_UNLINKED')).toEqual([]);
    },
  );
});

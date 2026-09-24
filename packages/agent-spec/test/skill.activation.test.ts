import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('skill.activation', () => {
  it('reports SKILL_ACTIVATION_MISSING when the description lacks «Úsala cuando»', async () => {
    expect(await errorsWithCode('skill-no-activation', 'SKILL_ACTIVATION_MISSING')).toEqual([
      {
        code: 'SKILL_ACTIVATION_MISSING',
        path: '.github/skills/vpn-diagnostics/SKILL.md',
        message: '`description` lacks an activation clause that starts with `Úsala cuando`',
      },
    ]);
  });

  it.each(['skill-valid', REPO_ROOT])(
    'accepts a description with the activation clause (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'SKILL_ACTIVATION_MISSING')).toEqual([]);
    },
  );
});

import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('skill.failure-section', () => {
  it('reports SKILL_FAILURE_SECTION_MISSING when the body has no Manejo de fallos section', async () => {
    expect(await errorsWithCode('skill-failure-missing', 'SKILL_FAILURE_SECTION_MISSING')).toEqual([
      {
        code: 'SKILL_FAILURE_SECTION_MISSING',
        path: '.github/skills/vpn-diagnostics/SKILL.md',
        message: 'the body has no `## Manejo de fallos` section',
      },
    ]);
  });

  it.each(['skill-body-valid', REPO_ROOT])(
    'accepts a Manejo de fallos section (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'SKILL_FAILURE_SECTION_MISSING')).toEqual([]);
    },
  );
});

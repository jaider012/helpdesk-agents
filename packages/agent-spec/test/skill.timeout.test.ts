import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('skill.timeout', () => {
  it.each([
    [
      'skill-deadline-equal',
      'DEFAULT_DEADLINE_MS of `scripts/check-vpn.js` (10000 ms) must be lower than the 10000 ms timeout',
    ],
    ['skill-timeout-missing', '`## Manejo de fallos` lacks the line `- **Timeout:** <n> s`'],
  ])('reports SKILL_DEADLINE_INVALID (%s)', async (name, message) => {
    expect(await errorsWithCode(name, 'SKILL_DEADLINE_INVALID')).toEqual([
      { code: 'SKILL_DEADLINE_INVALID', path: '.github/skills/vpn-diagnostics/SKILL.md', message },
    ]);
  });

  it.each(['skill-body-valid', REPO_ROOT])(
    'accepts a script deadline lower than the timeout (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'SKILL_DEADLINE_INVALID')).toEqual([]);
    },
  );
});

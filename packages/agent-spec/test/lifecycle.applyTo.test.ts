import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('lifecycle.applyTo', () => {
  it.each(['lifecycle-applyto-missing', 'lifecycle-applyto-wrong'])(
    'reports LIFECYCLE_APPLYTO_MISSING when applyTo lacks the **/tickets/** glob (%s)',
    async (name) => {
      const errors = await errorsWithCode(name, 'LIFECYCLE_APPLYTO_MISSING');

      expect(errors).toEqual([
        {
          code: 'LIFECYCLE_APPLYTO_MISSING',
          path: '.github/instructions/ticket-lifecycle.instructions.md',
          message: 'applyTo must include the glob `**/tickets/**`',
        },
      ]);
    },
  );

  it.each(['lifecycle-valid', 'lifecycle-applyto-list', REPO_ROOT])(
    'accepts an applyTo that includes **/tickets/** (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'LIFECYCLE_APPLYTO_MISSING')).toEqual([]);
    },
  );
});

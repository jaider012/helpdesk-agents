import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('lifecycle.table', () => {
  it.each([
    ['lifecycle-heading-missing', 'no GFM table under the heading `## Tabla de transiciones`'],
    ['lifecycle-column-missing', 'the transitions table lacks the column `campos obligatorios`'],
    ['lifecycle-unknown-field', 'T3: `entities.priority` is not a TicketState field'],
    ['lifecycle-bad-predicate', 'T5: `findings[verified]` is not a TicketState list flag'],
  ])(
    'reports LIFECYCLE_TABLE_INVALID for a malformed transitions table (%s)',
    async (name, message) => {
      expect(await errorsWithCode(name, 'LIFECYCLE_TABLE_INVALID')).toEqual([
        {
          code: 'LIFECYCLE_TABLE_INVALID',
          path: '.github/instructions/ticket-lifecycle.instructions.md',
          message,
        },
      ]);
    },
  );

  it.each(['lifecycle-valid', REPO_ROOT])(
    'accepts a well-formed transitions table (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'LIFECYCLE_TABLE_INVALID')).toEqual([]);
    },
  );
});

import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('lifecycle.status', () => {
  it('reports UNKNOWN_STATUS for a status outside TicketStatus', async () => {
    expect(await errorsWithCode('lifecycle-unknown-status', 'UNKNOWN_STATUS')).toEqual([
      {
        code: 'UNKNOWN_STATUS',
        path: '.github/instructions/ticket-lifecycle.instructions.md',
        message: 'T13: `REOPENED` is not a TicketStatus',
      },
    ]);
  });

  it.each(['lifecycle-valid', REPO_ROOT])('accepts the TicketStatus values (%s)', async (root) => {
    expect(await errorsWithCode(root, 'UNKNOWN_STATUS')).toEqual([]);
  });
});

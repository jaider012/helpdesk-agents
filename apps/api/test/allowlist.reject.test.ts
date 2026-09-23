import { describe, expect, it } from 'vitest';
import { ActionError } from '../src/tools/actions.js';
import { realActionService, tempAudit } from './action-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('allowlist.reject', () => {
  it('rejects an action absent from the allowlist with ACTION_NOT_ALLOWLISTED and logs action_rejected', async () => {
    const audit = await tempAudit();
    const actions = await realActionService(audit);
    const inProgress = ticket({ status: 'IN_PROGRESS' });

    const error = await actions
      .execute(inProgress, 'reset_password', 'diagnostics')
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ActionError);
    expect(error).toMatchObject({ code: 'ACTION_NOT_ALLOWLISTED' });
    expect(await audit.read(inProgress.ticketId)).toMatchObject([
      {
        agent: 'diagnostics',
        decision: 'action_rejected',
        reason: 'action `reset_password` is not in the remediation allowlist',
        data: { action: 'reset_password', code: 'ACTION_NOT_ALLOWLISTED' },
      },
    ]);
  });

  it('executes an allowlisted action and logs action_executed', async () => {
    const audit = await tempAudit();
    const actions = await realActionService(audit);
    const inProgress = ticket({ status: 'IN_PROGRESS' });

    expect(await actions.execute(inProgress, 'instruct_vpn_reconnect', 'diagnostics')).toEqual({
      id: 'instruct_vpn_reconnect',
      kind: 'instruction',
      allowlisted: true,
      agent: 'diagnostics',
      result: 'delivered',
      ts: '2026-09-23T10:30:00.000Z',
    });
    expect(await audit.read(inProgress.ticketId)).toMatchObject([
      { decision: 'action_executed', data: { action: 'instruct_vpn_reconnect' } },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { realActionService, tempAudit } from './action-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('lifecycle.escalated-no-remediation', () => {
  it('rejects even an allowlisted action while the ticket is ESCALATED', async () => {
    const audit = await tempAudit();
    const actions = await realActionService(audit);
    const escalated = ticket({ status: 'ESCALATED' });

    await expect(
      actions.execute(escalated, 'instruct_vpn_reconnect', 'diagnostics'),
    ).rejects.toThrow(expect.objectContaining({ code: 'ACTION_NOT_ALLOWLISTED' }));
    expect(await audit.read(escalated.ticketId)).toMatchObject([
      {
        decision: 'action_rejected',
        reason: 'no remediation action runs while the ticket is ESCALATED',
        data: { action: 'instruct_vpn_reconnect', code: 'ACTION_NOT_ALLOWLISTED' },
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { NOW, newTicket, runtime } from './runtime-helpers.js';

describe('graph.access-lockout', () => {
  it('executes instruct_self_service_unlock and resolves a lockout by retries', async () => {
    const { graph, audit } = await runtime();
    const ticketId = 'TCK-20260923-101500-lck';

    const final = await graph.invoke(
      newTicket(
        ticketId,
        'Me equivoqué varias veces con la contraseña y ahora mi cuenta está bloqueada.',
      ),
    );

    expect(final.status).toBe('RESOLVED');
    expect(final.findings).toMatchObject([
      {
        id: 'fnd_1',
        source: 'rule',
        conclusive: true,
        cause: 'account_locked_by_retries',
        ts: NOW,
      },
    ]);
    expect(final.actions).toMatchObject([
      { id: 'instruct_self_service_unlock', allowlisted: true, agent: 'diagnostics' },
    ]);
    expect(final.userMessage).toContain(`Caso ${ticketId}.`);
    expect(final.lastRoute).toEqual({ from: 'diagnostics', to: 'END', rule: 'R-D2' });
    const decisions = (await audit.read(ticketId)).map(({ decision }) => decision);
    expect(decisions).toContain('action_executed');
    expect(decisions).not.toContain('tool_run');
  });
});

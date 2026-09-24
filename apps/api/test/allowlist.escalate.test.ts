import type { SpecBundle } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import { newTicket, runtime } from './runtime-helpers.js';

/** The spec with the allowlist row of `actionId` removed from `diagnostics.agent.md`. */
const withoutAction =
  (actionId: string) =>
  (bundle: SpecBundle): SpecBundle => ({
    ...bundle,
    files: bundle.files.map((file) =>
      file.path.endsWith('diagnostics.agent.md') && file.frontmatter.ok
        ? {
            ...file,
            frontmatter: {
              ...file.frontmatter,
              body: file.frontmatter.body
                .split('\n')
                .filter((line) => !line.startsWith(`| \`${actionId}\``))
                .join('\n'),
            },
          }
        : file,
    ),
  });

describe('allowlist.escalate', () => {
  it('hands off to escalation with action_not_allowlisted when the runtime rejects the action', async () => {
    const { graph, audit } = await runtime({ spec: withoutAction('instruct_self_service_unlock') });
    const ticketId = 'TCK-20260923-101500-rej';

    const final = await graph.invoke(
      newTicket(ticketId, 'Me equivoqué varias veces y mi cuenta está bloqueada.'),
    );

    expect(final.status).toBe('ESCALATED');
    expect(final.actions).toEqual([]);
    expect(final.lastRoute).toEqual({
      from: 'diagnostics',
      to: 'escalation',
      rule: 'R-D8',
      reason: 'action_not_allowlisted',
    });
    expect(final.escalationPackage?.reason).toBe('action_not_allowlisted');
    expect(
      (await audit.read(ticketId)).find(({ decision }) => decision === 'action_rejected'),
    ).toMatchObject({
      agent: 'diagnostics',
      data: { action: 'instruct_self_service_unlock', code: 'ACTION_NOT_ALLOWLISTED' },
    });
  });
});

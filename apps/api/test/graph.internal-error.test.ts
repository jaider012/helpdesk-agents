import { describe, expect, it } from 'vitest';
import { triageRouteInput, withRouting } from '../src/graph/routing.js';
import type { GraphState } from '../src/graph/state.js';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';
import { newTicket, runtime, withoutRow } from './runtime-helpers.js';

describe('graph.internal-error', () => {
  it('routes the ticket to escalation with internal_error when a node raises an unexpected error', async () => {
    // Without the template of the unlock instruction, the diagnostics node fails after its action.
    const spec = withoutRow('copilot-instructions.md', '| `resolved.instruct_self_service_unlock`');
    const { graph, audit } = await runtime({ spec });
    const ticketId = 'TCK-20260923-101500-ier';

    const final = await graph.invoke(
      newTicket(ticketId, 'Me equivoqué varias veces y mi cuenta está bloqueada.'),
    );

    expect(final.status).toBe('ESCALATED');
    expect(final.lastRoute).toEqual({
      from: 'diagnostics',
      to: 'escalation',
      rule: 'R-X3',
      reason: 'internal_error',
    });
    expect(final.escalationPackage?.reason).toBe('internal_error');
    const entries = await audit.read(ticketId);
    expect(entries.find(({ decision }) => decision === 'error')).toMatchObject({
      agent: 'diagnostics',
      data: { error: 'Error' },
    });
    expect(
      entries
        .filter(({ decision }) => decision === 'transition')
        .map(({ from, to }) => `${from}→${to}`),
    ).toEqual(['NEW→TRIAGED', 'TRIAGED→IN_PROGRESS', 'IN_PROGRESS→ESCALATED']);
  });

  it('turns an unexpected error of the triage node into the R-X3 route', async () => {
    const { log } = await tempAuditLog();
    const failing = withRouting(
      'triage',
      () => {
        throw new TypeError('synthetic failure');
      },
      triageRouteInput,
      log,
    );

    const update = await failing({ ticketId: TICKET_ID, findings: [] } as unknown as GraphState);

    expect(update.lastRoute).toMatchObject({
      to: 'escalation',
      rule: 'R-X3',
      reason: 'internal_error',
    });
    expect((await log.read(TICKET_ID)).map(({ decision }) => decision)).toEqual([
      'error',
      'routed',
    ]);
  });
});

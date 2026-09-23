import { describe, expect, it } from 'vitest';
import { resolveRoute } from '../src/index.ts';

describe('routing.diagnostics', () => {
  it.each([
    ['vpn_ok', 'END', 'R-D1', undefined],
    ['lockout_instructed', 'END', 'R-D2', undefined],
    ['needs_user_input', 'END', 'R-D3', undefined],
    ['vpn_unhealthy', 'escalation', 'R-D4', 'vpn_gateway_unhealthy'],
    ['resource_unavailable', 'escalation', 'R-D5', 'skill_resource_unavailable'],
    ['identity_action', 'escalation', 'R-D6', 'requires_identity_action'],
    ['no_skill', 'escalation', 'R-D7', 'no_diagnostic_skill'],
    ['action_rejected', 'escalation', 'R-D8', 'action_not_allowlisted'],
  ] as const)('routes the outcome %s to %s by %s', (outcome, to, rule, reason) => {
    expect(resolveRoute('diagnostics', { kind: 'outcome', outcome })).toEqual({
      from: 'diagnostics',
      to,
      rule,
      ...(reason && { reason }),
    });
  });

  it('routes an internal error to escalation by R-X3', () => {
    expect(resolveRoute('diagnostics', { kind: 'error', error: 'internal' })).toEqual({
      from: 'diagnostics',
      to: 'escalation',
      rule: 'R-X3',
      reason: 'internal_error',
    });
  });
});

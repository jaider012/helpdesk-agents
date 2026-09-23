import { describe, expect, it } from 'vitest';
import { resolveRoute } from '../src/index.ts';

describe('routing.provisioning', () => {
  it('routes a completed approval request to escalation by R-P1 with approval_required', () => {
    expect(resolveRoute('provisioning', { kind: 'ok' })).toEqual({
      from: 'provisioning',
      to: 'escalation',
      rule: 'R-P1',
      reason: 'approval_required',
    });
  });

  it('routes an internal error to escalation by R-X3', () => {
    expect(resolveRoute('provisioning', { kind: 'error', error: 'internal' })).toEqual({
      from: 'provisioning',
      to: 'escalation',
      rule: 'R-X3',
      reason: 'internal_error',
    });
  });
});

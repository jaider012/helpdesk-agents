import { describe, expect, it } from 'vitest';
import { resolveRoute, type Category, type Severity } from '../src/index.ts';

const NOT_P1: Severity[] = ['P2', 'P3', 'P4'];

describe('routing.triage', () => {
  it.each([
    ...NOT_P1.map((severity) => ['infra', severity, 'diagnostics', 'R-T1', undefined] as const),
    ...NOT_P1.map((severity) => ['access', severity, 'diagnostics', 'R-T2', undefined] as const),
    ...NOT_P1.map(
      (severity) => ['provisioning', severity, 'provisioning', 'R-T3', undefined] as const,
    ),
    ...NOT_P1.map(
      (severity) => ['unknown', severity, 'escalation', 'R-T4', 'unknown_category'] as const,
    ),
    ...(['infra', 'access', 'provisioning', 'unknown'] as Category[]).map(
      (category) => [category, 'P1', 'escalation', 'R-T5', 'critical_severity'] as const,
    ),
  ])('routes %s with severity %s to %s by %s', (category, severity, to, rule, reason) => {
    expect(resolveRoute('triage', { kind: 'ok', category, severity })).toEqual({
      from: 'triage',
      to,
      rule,
      ...(reason && { reason }),
    });
  });

  it.each([
    ['llm_unavailable', 'R-X1', 'llm_unavailable'],
    ['invalid_llm_output', 'R-X2', 'invalid_llm_output'],
    ['internal', 'R-X3', 'internal_error'],
  ] as const)('routes the error %s to escalation by %s', (error, rule, reason) => {
    expect(resolveRoute('triage', { kind: 'error', error })).toEqual({
      from: 'triage',
      to: 'escalation',
      rule,
      reason,
    });
  });
});

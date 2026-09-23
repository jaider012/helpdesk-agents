import { describe, expect, it } from 'vitest';
import {
  ROUTE_INPUT_DOMAINS,
  ROUTING_RULES,
  routingDeterminismIssues,
  type RouteRule,
  type TriageRouteInput,
} from '../src/index.ts';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

const P1_INFRA = '{"kind":"ok","category":"infra","severity":"P1"}';

function triageRulesWith(rules: ReadonlyArray<RouteRule<TriageRouteInput>>) {
  return { ...ROUTING_RULES, triage: rules };
}

describe('routing.deterministic', () => {
  it('reports ROUTING_NOT_DETERMINISTIC for an input that matches more than one rule', () => {
    const overlapping = ROUTING_RULES.triage.map((rule) =>
      rule.id === 'R-T1'
        ? {
            ...rule,
            when: (input: TriageRouteInput) => input.kind === 'ok' && input.category === 'infra',
          }
        : rule,
    );

    expect(routingDeterminismIssues(triageRulesWith(overlapping), ROUTE_INPUT_DOMAINS)).toEqual([
      {
        code: 'ROUTING_NOT_DETERMINISTIC',
        path: 'packages/agent-spec/src/routing.ts',
        message: `\`triage\` input ${P1_INFRA} matches 2 rules (R-T1, R-T5)`,
      },
    ]);
  });

  it('reports ROUTING_NOT_DETERMINISTIC for an input that matches no rule', () => {
    const withoutP1 = ROUTING_RULES.triage.filter((rule) => rule.id !== 'R-T5');
    const issues = routingDeterminismIssues(triageRulesWith(withoutP1), ROUTE_INPUT_DOMAINS);

    expect(issues).toHaveLength(4);
    expect(issues[1]).toEqual({
      code: 'ROUTING_NOT_DETERMINISTIC',
      path: 'packages/agent-spec/src/routing.ts',
      message: `\`triage\` input ${P1_INFRA} matches 0 rules`,
    });
  });

  it('accepts the routing rules of routing.ts', async () => {
    expect(routingDeterminismIssues(ROUTING_RULES, ROUTE_INPUT_DOMAINS)).toEqual([]);
    expect(await errorsWithCode(REPO_ROOT, 'ROUTING_NOT_DETERMINISTIC')).toEqual([]);
  });
});

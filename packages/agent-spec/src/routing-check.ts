import type { HandoffGraph } from './graph.ts';
import type { RouteInputs, RouteRule, RoutingAgent } from './routing.ts';

export const ROUTING_PATH = 'packages/agent-spec/src/routing.ts';

export interface RoutingIssue {
  code: 'ROUTE_WITHOUT_HANDOFF' | 'ROUTING_NOT_DETERMINISTIC';
  path: string;
  message: string;
}

export type RoutingRules = { [A in RoutingAgent]: ReadonlyArray<RouteRule<RouteInputs[A]>> };
export type RouteInputDomains = { [A in RoutingAgent]: ReadonlyArray<RouteInputs[A]> };

function routingAgents(record: object): RoutingAgent[] {
  return Object.keys(record) as RoutingAgent[];
}

/** Every rule that leads to an agent must follow a handoff declared in `.agent.md` (REQ-2.3-15). */
export function routeHandoffIssues(graph: HandoffGraph, rules: RoutingRules): RoutingIssue[] {
  const declared = new Set(graph.edges.map(({ from, to }) => `${from}→${to}`));
  return routingAgents(rules).flatMap((agent) =>
    rules[agent]
      .filter((rule) => rule.to !== 'END' && !declared.has(`${rule.from}→${rule.to}`))
      .map((rule) => ({
        code: 'ROUTE_WITHOUT_HANDOFF' as const,
        path: graph.agents.get(rule.from) ?? `.github/agents/${rule.from}.agent.md`,
        message: `rule \`${rule.id}\` routes \`${rule.from}\` → \`${rule.to}\`, which is not a declared handoff`,
      })),
  );
}

/** Every value of every route input domain must match exactly one rule (REQ-2.3-16). */
export function routingDeterminismIssues(
  rules: RoutingRules,
  domains: RouteInputDomains,
): RoutingIssue[] {
  return routingAgents(domains).flatMap((agent) => {
    const agentRules = rules[agent] as ReadonlyArray<RouteRule<RouteInputs[typeof agent]>>;
    return (domains[agent] as ReadonlyArray<RouteInputs[typeof agent]>).flatMap((input) => {
      const matches = agentRules.filter((rule) => rule.when(input));
      if (matches.length === 1) return [];
      const ids = matches.length > 0 ? ` (${matches.map(({ id }) => id).join(', ')})` : '';
      return [
        {
          code: 'ROUTING_NOT_DETERMINISTIC' as const,
          path: ROUTING_PATH,
          message: `\`${agent}\` input ${JSON.stringify(input)} matches ${matches.length} rules${ids}`,
        },
      ];
    });
  });
}

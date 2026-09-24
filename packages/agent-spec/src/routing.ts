// Routing rules R-T1…R-X3 (design §2.1, ADR-02). Each agent produces a typed route input with a
// finite domain; exactly one rule matches each input. The validator enumerates the domains
// (REQ-2.3-16) and checks that every agent target is a declared handoff (REQ-2.3-15).
import type { AgentName } from './policy.ts';

export const CATEGORIES = ['access', 'infra', 'provisioning', 'unknown'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DIAGNOSTICS_OUTCOMES = [
  'vpn_ok',
  'lockout_instructed',
  'needs_user_input',
  'vpn_unhealthy',
  'resource_unavailable',
  'identity_action',
  'no_skill',
  'action_rejected',
] as const;
export type DiagnosticsOutcome = (typeof DIAGNOSTICS_OUTCOMES)[number];

export type EscalationReason =
  | 'critical_severity'
  | 'unknown_category'
  | 'skill_resource_unavailable'
  | 'vpn_gateway_unhealthy'
  | 'requires_identity_action'
  | 'no_diagnostic_skill'
  | 'action_not_allowlisted'
  | 'approval_required'
  | 'llm_unavailable'
  | 'invalid_llm_output'
  | 'internal_error'
  | 'operator_request';

export type TriageRouteInput =
  | { kind: 'ok'; category: Category; severity: Severity }
  | { kind: 'error'; error: 'llm_unavailable' | 'invalid_llm_output' | 'internal' };
export type DiagnosticsRouteInput =
  { kind: 'outcome'; outcome: DiagnosticsOutcome } | { kind: 'error'; error: 'internal' };
export type ProvisioningRouteInput = { kind: 'ok' } | { kind: 'error'; error: 'internal' };

export interface RouteInputs {
  triage: TriageRouteInput;
  diagnostics: DiagnosticsRouteInput;
  provisioning: ProvisioningRouteInput;
}
export type RoutingAgent = keyof RouteInputs;

export interface RouteRule<I> {
  id: string;
  from: AgentName;
  when: (input: I) => boolean;
  to: AgentName | 'END';
  reason?: EscalationReason;
}

export interface RouteDecision {
  from: AgentName | 'redact';
  to: AgentName | 'END';
  rule: string;
  reason?: EscalationReason;
}

const triageOk = (category: Category) => (input: TriageRouteInput) =>
  input.kind === 'ok' && input.category === category && input.severity !== 'P1';
const triageError = (error: string) => (input: TriageRouteInput) =>
  input.kind === 'error' && input.error === error;
const outcome = (value: DiagnosticsOutcome) => (input: DiagnosticsRouteInput) =>
  input.kind === 'outcome' && input.outcome === value;
const internal = (input: { kind: string; error?: string }) =>
  input.kind === 'error' && input.error === 'internal';

export const ROUTING_RULES: { [A in RoutingAgent]: ReadonlyArray<RouteRule<RouteInputs[A]>> } = {
  triage: [
    { id: 'R-T1', from: 'triage', when: triageOk('infra'), to: 'diagnostics' },
    { id: 'R-T2', from: 'triage', when: triageOk('access'), to: 'diagnostics' },
    { id: 'R-T3', from: 'triage', when: triageOk('provisioning'), to: 'provisioning' },
    {
      id: 'R-T4',
      from: 'triage',
      when: triageOk('unknown'),
      to: 'escalation',
      reason: 'unknown_category',
    },
    {
      id: 'R-T5',
      from: 'triage',
      when: (input) => input.kind === 'ok' && input.severity === 'P1',
      to: 'escalation',
      reason: 'critical_severity',
    },
    {
      id: 'R-X1',
      from: 'triage',
      when: triageError('llm_unavailable'),
      to: 'escalation',
      reason: 'llm_unavailable',
    },
    {
      id: 'R-X2',
      from: 'triage',
      when: triageError('invalid_llm_output'),
      to: 'escalation',
      reason: 'invalid_llm_output',
    },
    { id: 'R-X3', from: 'triage', when: internal, to: 'escalation', reason: 'internal_error' },
  ],
  diagnostics: [
    { id: 'R-D1', from: 'diagnostics', when: outcome('vpn_ok'), to: 'END' },
    { id: 'R-D2', from: 'diagnostics', when: outcome('lockout_instructed'), to: 'END' },
    { id: 'R-D3', from: 'diagnostics', when: outcome('needs_user_input'), to: 'END' },
    {
      id: 'R-D4',
      from: 'diagnostics',
      when: outcome('vpn_unhealthy'),
      to: 'escalation',
      reason: 'vpn_gateway_unhealthy',
    },
    {
      id: 'R-D5',
      from: 'diagnostics',
      when: outcome('resource_unavailable'),
      to: 'escalation',
      reason: 'skill_resource_unavailable',
    },
    {
      id: 'R-D6',
      from: 'diagnostics',
      when: outcome('identity_action'),
      to: 'escalation',
      reason: 'requires_identity_action',
    },
    {
      id: 'R-D7',
      from: 'diagnostics',
      when: outcome('no_skill'),
      to: 'escalation',
      reason: 'no_diagnostic_skill',
    },
    {
      id: 'R-D8',
      from: 'diagnostics',
      when: outcome('action_rejected'),
      to: 'escalation',
      reason: 'action_not_allowlisted',
    },
    { id: 'R-X3', from: 'diagnostics', when: internal, to: 'escalation', reason: 'internal_error' },
  ],
  provisioning: [
    {
      id: 'R-P1',
      from: 'provisioning',
      when: (input) => input.kind === 'ok',
      to: 'escalation',
      reason: 'approval_required',
    },
    {
      id: 'R-X3',
      from: 'provisioning',
      when: internal,
      to: 'escalation',
      reason: 'internal_error',
    },
  ],
};

/** Every value of each route input domain, for the exhaustive checks of the validator. */
export const ROUTE_INPUT_DOMAINS: { [A in RoutingAgent]: ReadonlyArray<RouteInputs[A]> } = {
  triage: [
    ...CATEGORIES.flatMap((category) =>
      SEVERITIES.map((severity) => ({ kind: 'ok' as const, category, severity })),
    ),
    ...(['llm_unavailable', 'invalid_llm_output', 'internal'] as const).map((error) => ({
      kind: 'error' as const,
      error,
    })),
  ],
  diagnostics: [
    ...DIAGNOSTICS_OUTCOMES.map((value) => ({ kind: 'outcome' as const, outcome: value })),
    { kind: 'error', error: 'internal' },
  ],
  provisioning: [{ kind: 'ok' }, { kind: 'error', error: 'internal' }],
};

/** Rules of `agent` that match `input`. */
export function matchingRules<A extends RoutingAgent>(
  agent: A,
  input: RouteInputs[A],
): ReadonlyArray<RouteRule<RouteInputs[A]>> {
  const rules = ROUTING_RULES[agent] as ReadonlyArray<RouteRule<RouteInputs[A]>>;
  return rules.filter((rule) => rule.when(input));
}

/** Resolves the target of a route input; throws when not exactly one rule matches. */
export function resolveRoute<A extends RoutingAgent>(
  agent: A,
  input: RouteInputs[A],
): RouteDecision {
  const matches = matchingRules(agent, input);
  if (matches.length !== 1) {
    throw new Error(
      `routing of ${agent} is not deterministic for ${JSON.stringify(input)}: ${matches.length} rules match`,
    );
  }
  const [{ id, to, reason }] = matches;
  return reason ? { from: agent, to, rule: id, reason } : { from: agent, to, rule: id };
}

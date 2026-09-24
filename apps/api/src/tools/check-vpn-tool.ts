import type { DiagnosticsOutcome } from 'agent-spec';
import { z } from 'zod';
import type { AuditLog } from '../audit/audit-log.js';
import type { DiagnosticFinding } from '../tickets/ticket-state.js';
import type { ScriptRun, SkillRunner, SkillScript } from './skill-runner.js';

/** The part of the check-vpn.js output that the runtime reads (design §6.1). */
const CheckVpnOutput = z.object({
  ok: z.boolean(),
  checks: z.array(
    z.object({
      name: z.enum(['dns', 'tcp', 'latency']),
      status: z.enum(['pass', 'fail', 'skip']),
      durationMs: z.number(),
      reason: z.string().optional(),
    }),
  ),
  summary: z.string(),
});
type CheckVpnOutput = z.infer<typeof CheckVpnOutput>;

export type VpnOutcome = Extract<
  DiagnosticsOutcome,
  'vpn_ok' | 'vpn_unhealthy' | 'resource_unavailable'
>;

export interface VpnCheck {
  finding: DiagnosticFinding;
  outcome: VpnOutcome;
}

const CAUSE_OF_FAILED_CHECK = {
  dns: 'dns_failure',
  tcp: 'gateway_unreachable',
  latency: 'high_latency',
} as const;

/** stdout as check-vpn JSON, or undefined when it is not (REQ-2.2-25, REQ-2.2-30). */
function parseOutput(stdout: string): CheckVpnOutput | undefined {
  try {
    const result = CheckVpnOutput.safeParse(JSON.parse(stdout));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The finding and the diagnostics outcome of a check-vpn run (REQ-2.2-27, design §6.3). The JSON is
 * checked before the exit code: without valid JSON the resource is unavailable whatever the code.
 */
export function vpnCheckFrom(run: ScriptRun, meta: { findingId: string; ts: string }): VpnCheck {
  const output = run.timedOut ? undefined : parseOutput(run.stdout);
  const failed = output?.checks.find(({ status }) => status === 'fail');
  const base = {
    id: meta.findingId,
    source: 'check-vpn' as const,
    // Codes other than 0, 1 and 2 are script errors too.
    exitCode: run.exitCode === null || run.exitCode <= 2 ? (run.exitCode as 0 | 1 | 2 | null) : 2,
    durationMs: Math.round(run.durationMs),
    ts: meta.ts,
  };
  if (output && run.exitCode === 0) {
    const { checks, summary } = output;
    const finding = {
      ...base,
      conclusive: true,
      cause: 'gateway_healthy' as const,
      checks,
      summary,
    };
    return { outcome: 'vpn_ok', finding };
  }
  if (output && run.exitCode === 1 && failed) {
    const { checks, summary } = output;
    const cause = CAUSE_OF_FAILED_CHECK[failed.name];
    return {
      outcome: 'vpn_unhealthy',
      finding: { ...base, conclusive: true, cause, checks, summary },
    };
  }
  const summary = run.timedOut
    ? 'check-vpn.js was killed by the runtime timeout'
    : (output?.summary ?? 'check-vpn.js printed no valid JSON');
  return {
    outcome: 'resource_unavailable',
    finding: {
      ...base,
      conclusive: false,
      cause: 'resource_unavailable',
      ...(output && { checks: output.checks }),
      summary,
    },
  };
}

/**
 * check-vpn.js as a diagnostics tool: runs it through the skill runner and turns the run into a
 * finding. When the resource is unavailable, it records `skill_resource_unavailable` with the exit
 * code and the elapsed time (REQ-2.2-26).
 */
export class CheckVpnTool {
  constructor(
    private readonly runner: SkillRunner,
    private readonly script: SkillScript,
    private readonly audit: AuditLog,
    private readonly clock: () => Date,
  ) {}

  async run(target: string, context: { ticketId: string; findingId: string }): Promise<VpnCheck> {
    const { ticketId, findingId } = context;
    const run = await this.runner.run(this.script, ['--target', target], {
      ticketId,
      agent: 'diagnostics',
    });
    const check = vpnCheckFrom(run, { findingId, ts: this.clock().toISOString() });
    if (check.outcome === 'resource_unavailable') {
      const cause = run.timedOut
        ? 'timeout'
        : parseOutput(run.stdout)
          ? 'exit_code'
          : 'invalid_output';
      await this.audit.append({
        ticketId,
        agent: 'diagnostics',
        decision: 'skill_resource_unavailable',
        reason: check.finding.summary,
        data: {
          skill: this.script.skill,
          script: this.script.script,
          cause,
          exitCode: run.exitCode,
          durationMs: check.finding.durationMs,
        },
      });
    }
    return check;
  }
}

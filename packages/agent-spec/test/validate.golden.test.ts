import { describe, expect, it } from 'vitest';
import {
  buildHandoffGraph,
  compileAllowlist,
  compileLifecycle,
  loadSpec,
  promptName,
  promptVariables,
  skillTimeoutMs,
  validateSpec,
  type SpecBundle,
} from '../src/index.ts';
import { runCli } from './cli.ts';
import { REPO_ROOT } from './helpers.ts';

function body(bundle: SpecBundle, path: string): string {
  const file = bundle.files.find((candidate) => candidate.path === path);
  if (!file?.frontmatter.ok) throw new Error(`${path} is missing or invalid`);
  return file.frontmatter.body;
}

describe('validate.golden', () => {
  it('finds no errors in the real .github/ and the CLI exits with code 0', async () => {
    expect(validateSpec(await loadSpec(REPO_ROOT))).toEqual([]);
    expect(runCli(REPO_ROOT)).toEqual({ code: 0, stdout: 'spec:validate: OK\n' });
  });

  it('compiles the real .github/ into the graph, lifecycle, allowlist, skill and prompts of the design', async () => {
    const bundle = await loadSpec(REPO_ROOT);
    const graph = buildHandoffGraph(bundle);

    expect([...graph.agents.keys()].sort()).toEqual([
      'diagnostics',
      'escalation',
      'provisioning',
      'triage',
    ]);
    expect(graph.edges.map(({ from, to, label }) => `${from} → ${to} (${label})`).sort()).toEqual([
      'diagnostics → escalation (Escalar)',
      'provisioning → escalation (Enviar a aprobación)',
      'triage → diagnostics (Diagnosticar)',
      'triage → escalation (Escalar)',
      'triage → provisioning (Preparar solicitud de aprobación)',
    ]);

    const lifecycle = compileLifecycle(
      body(bundle, '.github/instructions/ticket-lifecycle.instructions.md'),
    );
    expect(lifecycle.issues).toEqual([]);
    expect(lifecycle.spec.transitions.map(({ id, from, to }) => `${id} ${from}→${to}`)).toEqual([
      'T1 NEW→TRIAGED',
      'T2 NEW→ESCALATED',
      'T3 TRIAGED→IN_PROGRESS',
      'T4 TRIAGED→ESCALATED',
      'T5 IN_PROGRESS→RESOLVED',
      'T6 IN_PROGRESS→WAITING_USER',
      'T7 IN_PROGRESS→ESCALATED',
      'T8 WAITING_USER→IN_PROGRESS',
      'T9 WAITING_USER→ESCALATED',
      'T10 WAITING_USER→CLOSED',
      'T11 RESOLVED→CLOSED',
      'T12 ESCALATED→CLOSED',
    ]);

    const allowlist = compileAllowlist(body(bundle, '.github/agents/diagnostics.agent.md'));
    expect(allowlist.map(({ id, kind }) => `${id} (${kind})`)).toEqual([
      'instruct_vpn_reconnect (instruction)',
      'instruct_self_service_unlock (instruction)',
    ]);

    expect(skillTimeoutMs(body(bundle, '.github/skills/vpn-diagnostics/SKILL.md'))).toBe(10_000);

    const prompts = bundle.files
      .filter((file) => file.kind === 'prompt' && file.frontmatter.ok)
      .map((file) => [
        promptName(file),
        file.frontmatter.ok ? promptVariables(file.frontmatter.body).map(({ name }) => name) : [],
      ]);
    expect(Object.fromEntries(prompts)).toEqual({
      'escalate-ticket': ['ticketId', 'reason'],
      'run-vpn-diagnostics': ['ticketId', 'target'],
      'triage-ticket': ['channel', 'ticket'],
    });
  });
});

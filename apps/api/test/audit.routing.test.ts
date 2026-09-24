import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSpec } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/audit/audit-log.js';
import { buildGraph } from '../src/graph/build.js';
import { compileAgents } from '../src/graph/compile-agents.js';
import { createRedactNode } from '../src/graph/nodes/redact.node.js';
import { createTriageNode } from '../src/graph/nodes/triage.node.js';
import { triageRouteInput, withRouting } from '../src/graph/routing.js';
import { compileSeverityMatrix } from '../src/graph/severity-matrix.js';
import type { GraphState } from '../src/graph/state.js';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { fakeResponder } from '../src/llm/fake-responder.js';
import { TicketStateMachine } from '../src/tickets/state-machine.js';
import { TicketLifecycle } from '../src/tickets/ticket-lifecycle.js';
import { TicketStore } from '../src/tickets/ticket-store.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

const TICKET_ID = 'TCK-20260923-101500-rtg';

async function setup() {
  const bundle = await loadSpec(REPO_ROOT);
  const agents = compileAgents(bundle);
  const triageAgent = agents.find(({ name }) => name === 'triage');
  if (!triageAgent) throw new Error('triage agent not found');
  const dataDir = await mkdtemp(join(tmpdir(), 'helpdesk-routing-'));
  const audit = new AuditLog(dataDir, () => new Date('2026-09-23T10:15:00.000Z'));
  const lifecycle = new TicketLifecycle(
    TicketStateMachine.fromBundle(bundle),
    audit,
    new TicketStore(dataDir),
  );
  const triage = withRouting(
    'triage',
    createTriageNode({
      model: new FakeChatModel(fakeResponder),
      systemPrompt: triageAgent.systemPrompt,
      severity: compileSeverityMatrix(triageAgent.systemPrompt),
      audit,
      lifecycle,
      timeoutMs: 30_000,
    }),
    triageRouteInput,
    audit,
  );
  return { bundle, agents, audit, triage };
}

const state = (redactedText: string) =>
  ({
    ticketId: TICKET_ID,
    redactedText,
    entities: { userRef: 'usr_a1b2c3d4' },
    status: 'NEW',
    findings: [],
    actions: [],
    audit: [],
  }) as unknown as GraphState;

describe('audit.routing', () => {
  it.each([
    ['La VPN no conecta.', 'diagnostics', 'R-T1', undefined],
    ['Mi cuenta está bloqueada por varios intentos.', 'diagnostics', 'R-T2', undefined],
    ['Necesito acceso a la carpeta finanzas-2026.', 'provisioning', 'R-T3', undefined],
    ['La impresora no imprime.', 'escalation', 'R-T4', 'unknown_category'],
    ['Nadie en la sede puede trabajar: todo detenido.', 'escalation', 'R-T5', 'critical_severity'],
  ])(
    'records the target and the rule of the routing decision for «%s»',
    async (text, to, rule, reason) => {
      const { audit, triage } = await setup();

      const update = await triage(state(text));

      const decision = { from: 'triage', to, rule, ...(reason && { reason }) };
      expect(update).toMatchObject({ lastRoute: decision, nextAgent: to });
      expect((await audit.read(TICKET_ID)).at(-1)).toMatchObject({
        agent: 'triage',
        decision: 'routed',
        from: 'triage',
        to,
        data: { rule, ...(reason && { reason }) },
      });
    },
  );

  it('routes the running graph from triage to the target of the decision', async () => {
    const { bundle, agents, audit, triage } = await setup();
    const visited: string[] = [];
    const record = (name: string) => () => {
      visited.push(name);
      return {};
    };
    const graph = buildGraph(bundle, agents, {
      redact: createRedactNode({ audit, salt: 'synthetic-test-salt' }),
      triage,
      diagnostics: record('diagnostics'),
      provisioning: record('provisioning'),
      escalation: record('escalation'),
    });

    const final = await graph.invoke({
      ticketId: TICKET_ID,
      rawText: 'Soy ana.demo@example.com y la VPN no conecta.',
      status: 'NEW',
      entryAgent: 'triage',
    });

    expect(visited).toEqual(['diagnostics']);
    expect(final.lastRoute).toEqual({ from: 'triage', to: 'diagnostics', rule: 'R-T1' });
    expect((await audit.read(TICKET_ID)).map(({ decision }) => decision)).toEqual([
      'redacted',
      'classified',
      'transition',
      'routed',
    ]);
  });
});

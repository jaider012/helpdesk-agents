import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BaseMessage } from '@langchain/core/messages';
import { loadSpec } from 'agent-spec';
import { AuditLog } from '../src/audit/audit-log.js';
import { compileAgents } from '../src/graph/compile-agents.js';
import { createRedactNode } from '../src/graph/nodes/redact.node.js';
import { createTriageNode } from '../src/graph/nodes/triage.node.js';
import { compileSeverityMatrix } from '../src/graph/severity-matrix.js';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { fakeResponder } from '../src/llm/fake-responder.js';
import { TicketStateMachine } from '../src/tickets/state-machine.js';
import { TicketLifecycle } from '../src/tickets/ticket-lifecycle.js';
import { TicketStore } from '../src/tickets/ticket-store.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

export const SALT = 'synthetic-test-salt';

/** Runs the redact node and then the triage node on a raw ticket text, as the graph does. */
export async function triage(rawText: string) {
  const bundle = await loadSpec(REPO_ROOT);
  const agent = compileAgents(bundle).find(({ name }) => name === 'triage');
  if (!agent) throw new Error('triage agent not found');
  const seen: BaseMessage[][] = [];
  const model = new FakeChatModel((messages, tools) => {
    seen.push(messages);
    return fakeResponder(messages, tools);
  });
  const dataDir = await mkdtemp(join(tmpdir(), 'helpdesk-triage-'));
  const audit = new AuditLog(dataDir, () => new Date('2026-09-23T10:15:00.000Z'));
  const machine = TicketStateMachine.fromBundle(bundle);
  const lifecycle = new TicketLifecycle(machine, audit, new TicketStore(dataDir));
  const redactNode = createRedactNode({ audit, salt: SALT });
  const triageNode = createTriageNode({
    model,
    systemPrompt: agent.systemPrompt,
    severity: compileSeverityMatrix(agent.systemPrompt),
    audit,
    lifecycle,
    timeoutMs: 30_000,
  });
  const base = {
    ticketId: 'TCK-20260923-101500-abc',
    channel: 'email' as const,
    createdAt: '2026-09-23T10:15:00.000Z',
    status: 'NEW' as const,
    entryAgent: 'triage' as const,
    findings: [],
    actions: [],
    audit: [],
  };
  const redacted = await redactNode({ ...base, rawText } as never);
  const classified = await triageNode({ ...base, ...redacted } as never);
  return {
    redacted,
    classified,
    seen,
    audit: await audit.read(base.ticketId),
    systemPrompt: agent.systemPrompt,
  };
}

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { loadSpec } from 'agent-spec';
import { AuditLog } from '../src/audit/audit-log.js';
import { buildGraph, type GraphNodes } from '../src/graph/build.js';
import { compileAgents } from '../src/graph/compile-agents.js';
import { createNodes } from '../src/graph/nodes/index.js';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { createFakeResponder } from '../src/llm/fake-responder.js';
import { templatesFromBundle } from '../src/messages/templates.js';
import { TicketStateMachine } from '../src/tickets/state-machine.js';
import { TicketStore } from '../src/tickets/ticket-store.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

export const NOW = '2026-09-23T10:15:00.000Z';

export interface RuntimeOptions {
  model?: BaseChatModel;
  override?: Partial<GraphNodes>;
  audit?: (dataDir: string, clock: () => Date) => AuditLog;
  llmTimeoutMs?: number;
}

/** The runtime graph over the real spec, a temporary data folder and the fake model. */
export async function runtime(options: RuntimeOptions = {}) {
  const bundle = await loadSpec(REPO_ROOT);
  const dataDir = await mkdtemp(join(tmpdir(), 'helpdesk-runtime-'));
  const clock = () => new Date(NOW);
  const audit = options.audit?.(dataDir, clock) ?? new AuditLog(dataDir, clock);
  const store = new TicketStore(dataDir);
  const nodes = createNodes({
    bundle,
    model: options.model ?? new FakeChatModel(createFakeResponder(templatesFromBundle(bundle))),
    audit,
    store,
    machine: TicketStateMachine.fromBundle(bundle),
    salt: 'synthetic-test-salt',
    clock,
    llmTimeoutMs: options.llmTimeoutMs ?? 30_000,
  });
  const graph = buildGraph(bundle, compileAgents(bundle), { ...nodes, ...options.override });
  return { graph, audit, store, dataDir };
}

/** Starts the graph at triage with a new ticket. */
export function newTicket(ticketId: string, rawText: string) {
  return {
    ticketId,
    rawText,
    channel: 'email' as const,
    createdAt: NOW,
    status: 'NEW' as const,
    entryAgent: 'triage' as const,
  };
}

import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AuditEntry } from '../src/audit/audit-entry.js';
import { AuditLog, AuditWriteError } from '../src/audit/audit-log.js';
import { withNodeEvents } from '../src/graph/node-events.js';
import type { GraphState } from '../src/graph/state.js';
import { StoreWriteError } from '../src/tickets/ticket-store.js';
import { newTicket, runtime } from './runtime-helpers.js';

const GRAPH_NODES = ['redact', 'triage', 'diagnostics', 'provisioning', 'escalation'];

/** The nodes in the order they started. */
const visited = (entries: AuditEntry[]) =>
  entries.filter(({ decision }) => decision === 'node_started').map(({ agent }) => agent);

/**
 * Each visited node has a `node_started` before any other entry of that node and a
 * `node_finished` with `durationMs` after all of them, its `routed` decision included.
 */
function expectNodeWindows(entries: AuditEntry[]) {
  for (const node of visited(entries)) {
    const start = entries.findIndex((e) => e.agent === node && e.decision === 'node_started');
    const end = entries.findIndex((e) => e.agent === node && e.decision === 'node_finished');
    expect(end, `${node} finished`).toBeGreaterThan(start);
    expect(entries[end]?.data?.durationMs).toBeGreaterThanOrEqual(0);
    entries.forEach((entry, index) => {
      if (entry.agent === node) {
        expect(index, `${node}:${entry.decision}`).toBeGreaterThanOrEqual(start);
        expect(index, `${node}:${entry.decision}`).toBeLessThanOrEqual(end);
      }
    });
    const routed = entries.findIndex((e) => e.agent === node && e.decision === 'routed');
    if (routed !== -1) expect(routed).toBeGreaterThan(start);
  }
}

describe('graph.node-events', () => {
  it.each([
    {
      name: 'a VPN ticket',
      ticketId: 'TCK-20260923-101500-ne1',
      text: 'La VPN no me conecta desde esta mañana.',
      nodes: ['redact', 'triage', 'diagnostics', 'escalation'],
    },
    {
      name: 'a provisioning ticket',
      ticketId: 'TCK-20260923-101500-ne2',
      text: 'Necesito acceso de lectura a la carpeta finanzas-2026 para el cierre del mes.',
      nodes: ['redact', 'triage', 'provisioning', 'escalation'],
    },
  ])('records node_started and node_finished around every node of $name', async (run) => {
    const { graph, audit } = await runtime();

    await graph.invoke(newTicket(run.ticketId, run.text));

    const entries = await audit.read(run.ticketId);
    expect(visited(entries)).toEqual(run.nodes);
    expect(
      entries.filter(({ decision }) => decision === 'node_finished').map(({ agent }) => agent),
    ).toEqual(run.nodes);
    expect(entries.filter(({ agent }) => GRAPH_NODES.includes(agent)).at(0)?.decision).toBe(
      'node_started',
    );
    expectNodeWindows(entries);
  });

  // Permissions do not bind root, so the read-only folder would not fail there.
  it.skipIf(process.getuid?.() === 0)(
    'records node_finished with the error name when the ticket store fails',
    async () => {
      const { graph, audit, dataDir } = await runtime();
      await mkdir(join(dataDir, 'tickets'), { mode: 0o500 });
      const ticketId = 'TCK-20260923-101500-ne3';

      await expect(
        graph.invoke(newTicket(ticketId, 'La VPN no me conecta.')),
      ).rejects.toBeInstanceOf(StoreWriteError);

      const entries = await audit.read(ticketId);
      expect(entries.at(-1)).toMatchObject({
        agent: 'triage',
        decision: 'node_finished',
        data: { error: 'StoreWriteError' },
      });
      expectNodeWindows(entries);
    },
  );

  it('does not write node_finished again when the audit log fails', async () => {
    const audit = new AuditLog(await mkdtemp(join(tmpdir(), 'helpdesk-node-events-')));
    const append = vi.spyOn(audit, 'append');
    const node = withNodeEvents(
      'triage',
      async () => {
        throw new AuditWriteError(new Error('synthetic write failure'));
      },
      audit,
    );

    await expect(
      node({ ticketId: 'TCK-20260923-101500-ne4' } as GraphState),
    ).rejects.toBeInstanceOf(AuditWriteError);

    expect(append.mock.calls.map(([entry]) => entry.decision)).toEqual(['node_started']);
  });
});

import { performance } from 'node:perf_hooks';
import { AuditWriteError, type AuditLog } from '../audit/audit-log.js';
import type { GraphNode, GraphNodeName } from './build.js';

/**
 * Brackets a graph node with `node_started` and `node_finished` (with `durationMs`), from which
 * the web app draws each step of the timeline (design §12.1). If the node fails, `node_finished`
 * carries the error name and the error goes on; a failed audit write is not retried.
 */
export function withNodeEvents(name: GraphNodeName, node: GraphNode, audit: AuditLog): GraphNode {
  return async (state) => {
    const { ticketId } = state;
    await audit.append({
      ticketId,
      agent: name,
      decision: 'node_started',
      reason: `the ${name} node started`,
    });
    const start = performance.now();
    const durationMs = () => Math.round(performance.now() - start);
    try {
      const update = await node(state);
      await audit.append({
        ticketId,
        agent: name,
        decision: 'node_finished',
        reason: `the ${name} node finished`,
        data: { durationMs: durationMs() },
      });
      return update;
    } catch (error) {
      if (!(error instanceof AuditWriteError)) {
        await audit.append({
          ticketId,
          agent: name,
          decision: 'node_finished',
          reason: `the ${name} node stopped with an error`,
          data: { durationMs: durationMs(), error: error instanceof Error ? error.name : 'error' },
        });
      }
      throw error;
    }
  };
}

import { AuditEntry } from '../../core/contracts';
import { actorLabel, statusLabel } from '../../core/labels';

export type TimelineKind = 'node' | 'handoff' | 'transition' | 'tool';

export interface TimelineItem {
  /** `seq` of the audit entry that opened the item. */
  seq: number;
  ts: string;
  kind: TimelineKind;
  title: string;
  reason?: string;
  /** Milliseconds; for a node, from `node_started` to its `node_finished`. */
  durationMs?: number;
  /** A node that has started and not finished yet. */
  running?: boolean;
  /** For a status transition, the status it reaches. */
  status?: string;
}

/**
 * Derives the graph timeline from the audit log, the single source of truth (specs/design.md §12.1):
 * visited nodes (`node_started` + `node_finished`), handoffs (`routed`), status decisions
 * (`transition`) and tool runs (`tool_run`). Entries are applied in `seq` order.
 */
export function buildTimeline(entries: readonly AuditEntry[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const openNodes = new Map<string, TimelineItem>();

  for (const entry of [...entries].sort((a, b) => a.seq - b.seq)) {
    switch (entry.decision) {
      case 'node_started': {
        const item: TimelineItem = {
          seq: entry.seq,
          ts: entry.ts,
          kind: 'node',
          title: actorLabel(entry.agent),
          running: true,
        };
        openNodes.set(entry.agent, item);
        items.push(item);
        break;
      }
      case 'node_finished': {
        const item = openNodes.get(entry.agent);
        if (item) {
          item.running = false;
          item.durationMs = Date.parse(entry.ts) - Date.parse(item.ts);
          openNodes.delete(entry.agent);
        }
        break;
      }
      case 'routed':
        items.push({
          ...base(entry, 'handoff'),
          title: `${actorLabel(entry.from ?? entry.agent)} → ${actorLabel(entry.to)}`,
        });
        break;
      case 'transition':
        items.push({
          ...base(entry, 'transition'),
          title: `${statusLabel(entry.from)} → ${statusLabel(entry.to)}`,
          status: entry.to,
        });
        break;
      case 'tool_run':
        items.push({
          ...base(entry, 'tool'),
          title: actorLabel(entry.agent),
          durationMs: numberOrUndefined(entry.data?.['durationMs']),
        });
        break;
    }
  }
  return items;
}

function base(entry: AuditEntry, kind: TimelineKind) {
  return { seq: entry.seq, ts: entry.ts, kind, reason: entry.reason };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** `850 ms`, `1,5 s` or `2 min 5 s`. */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
  }
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

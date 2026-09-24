import { AuditEntry } from '../core/contracts';

/**
 * Joins the audit entries of `GET /tickets/:id/audit` and of the live stream: each `seq` once,
 * in write order (`seq` is monotonic per ticket). The same entry can arrive by both ways.
 */
export function mergeAudit(...lists: ReadonlyArray<readonly AuditEntry[]>): AuditEntry[] {
  const bySeq = new Map<number, AuditEntry>();
  for (const list of lists) {
    for (const entry of list) {
      if (!bySeq.has(entry.seq)) {
        bySeq.set(entry.seq, entry);
      }
    }
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

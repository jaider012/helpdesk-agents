import type { MessageEvent } from '@nestjs/common';
import type { TicketStatus } from 'agent-spec';
import { Observable } from 'rxjs';
import type { AuditEntry } from '../audit/audit-entry.js';
import type { AuditFeed } from '../audit/audit-feed.js';
import type { AuditLog } from '../audit/audit-log.js';

export interface TicketEventsDeps {
  audit: AuditLog;
  feed: AuditFeed;
  /** Settles when the running graph of the ticket ends; `undefined` when none is running. */
  run: Promise<void> | undefined;
  /** The status to send with `done`, read once the run is over. */
  status: () => Promise<TicketStatus>;
}

/**
 * The SSE stream of a ticket (design §12.1): the audit entries already written, then each new one
 * as it is written (`audit`, with `seq` as event id), and `done { status }` once the graph run
 * ends, or at once when none is running. Each `seq` goes out once, in write order.
 */
export function ticketEvents(
  ticketId: string,
  { audit, feed, run, status }: TicketEventsDeps,
): Observable<MessageEvent> {
  return new Observable<MessageEvent>((subscriber) => {
    let lastSeq = 0;
    const send = (entry: AuditEntry) => {
      if (entry.seq <= lastSeq) return;
      lastSeq = entry.seq;
      subscriber.next({ type: 'audit', id: String(entry.seq), data: entry });
    };
    // Subscribe before reading, so an entry written in between is buffered instead of lost.
    const pending: AuditEntry[] = [];
    let replaying = true;
    const unsubscribe = feed.subscribe(ticketId, (entry) =>
      replaying ? pending.push(entry) : send(entry),
    );
    (async () => {
      for (const entry of await audit.read(ticketId)) send(entry);
      replaying = false;
      pending.forEach(send);
      await run;
      subscriber.next({ type: 'done', data: { status: await status() } });
      subscriber.complete();
    })().catch((error: unknown) => subscriber.error(error));
    return unsubscribe;
  });
}

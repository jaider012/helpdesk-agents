import { EventEmitter } from 'node:events';
import type { AuditEntry } from './audit-entry.js';

/** Publishes each entry that the audit log writes, by ticket, to the SSE streams (REQ-API-07). */
export class AuditFeed {
  // One listener per open stream: no limit.
  private readonly emitter = new EventEmitter().setMaxListeners(0);

  publish(entry: AuditEntry): void {
    this.emitter.emit(entry.ticketId, entry);
  }

  /** Calls `listener` with every new entry of the ticket; the returned function stops it. */
  subscribe(ticketId: string, listener: (entry: AuditEntry) => void): () => void {
    this.emitter.on(ticketId, listener);
    return () => this.emitter.off(ticketId, listener);
  }
}

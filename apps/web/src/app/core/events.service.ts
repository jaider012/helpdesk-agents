import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.service';
import { AuditEntry, TicketStatus } from './contracts';

/** Events of `GET /tickets/:id/events` (specs/design.md §12.1). */
export type TicketEvent =
  { type: 'audit'; entry: AuditEntry } | { type: 'done'; status: TicketStatus };

/** Server-Sent Events of the ticket runs, over `EventSource`. */
@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Emits every audit entry the api writes for the ticket (`audit`) and, when the run ends,
   * `done` with the final status; then it completes and closes the connection.
   */
  ticketEvents(ticketId: string): Observable<TicketEvent> {
    const url = `${this.baseUrl}/tickets/${encodeURIComponent(ticketId)}/events`;
    return new Observable<TicketEvent>((subscriber) => {
      const source = new EventSource(url);
      source.addEventListener('audit', (event) => {
        subscriber.next({ type: 'audit', entry: JSON.parse(event.data) as AuditEntry });
      });
      source.addEventListener('done', (event) => {
        const { status } = JSON.parse(event.data) as { status: TicketStatus };
        subscriber.next({ type: 'done', status });
        subscriber.complete();
      });
      return () => source.close();
    });
  }
}

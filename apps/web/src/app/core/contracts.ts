// Data contracts of the api (specs/design.md §4 and §12.1). The api owns them; the web app only reads.

export type TicketStatus =
  'NEW' | 'TRIAGED' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
export type Category = 'access' | 'infra' | 'provisioning' | 'unknown';
export type Severity = 'P1' | 'P2' | 'P3' | 'P4';

/** One row of `GET /tickets`. */
export interface TicketSummary {
  ticketId: string;
  category?: Category;
  severity?: Severity;
  status: TicketStatus;
  slaDueAt?: string;
}

/** `TCK-AAAAMMDD-HHMMSS-xxx`, where `xxx` are 3 lowercase base36 characters (design §4). */
export const TICKET_ID_PATTERN = /^TCK-\d{8}-\d{6}-[0-9a-z]{3}$/;

/** Guards every file path built from a ticketId against path traversal (design §8.1). */
export function assertTicketId(ticketId: string): void {
  // The value is not echoed: it may come from a request.
  if (!TICKET_ID_PATTERN.test(ticketId)) throw new Error('invalid ticketId');
}

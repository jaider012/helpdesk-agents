import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assertTicketId } from './ticket-id.js';
import type { TicketState } from './ticket-state.js';

/** The ticket store could not write the ticket state: the run stops (REQ-AUD-08). */
export class StoreWriteError extends Error {
  readonly code = 'STORE_WRITE_FAILED';

  constructor(cause: unknown) {
    super('STORE_WRITE_FAILED: the ticket store could not write the ticket', { cause });
    this.name = 'StoreWriteError';
  }
}

function ticketFile(dataDir: string, ticketId: string): string {
  assertTicketId(ticketId);
  return join(dataDir, 'tickets', `${ticketId}.json`);
}

/** The ticket without its audit entries, which live in the JSONL audit log. */
function withoutAudit(ticket: TicketState): Omit<TicketState, 'audit'> {
  const stored: Partial<TicketState> = { ...ticket };
  delete stored.audit;
  return stored as Omit<TicketState, 'audit'>;
}

/** `<dataDir>/tickets/<ticketId>.json`: the current state of each ticket (design §12.4). */
export class TicketStore {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async read(ticketId: string): Promise<TicketState | undefined> {
    try {
      const stored = JSON.parse(await readFile(ticketFile(this.dataDir, ticketId), 'utf8'));
      return { ...stored, audit: [] } as TicketState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  /**
   * Atomic write: a temporary file in the same folder, then a rename over the ticket file. Any
   * failure is a `StoreWriteError` (REQ-AUD-08).
   */
  async save(ticket: TicketState): Promise<void> {
    const file = ticketFile(this.dataDir, ticket.ticketId);
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(temporary, `${JSON.stringify(withoutAudit(ticket), null, 2)}\n`);
      await rename(temporary, file);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw new StoreWriteError(error);
    }
  }
}

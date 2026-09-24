import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { redact } from '../redact/redact.js';
import { assertTicketId } from '../tickets/ticket-id.js';
import type { AuditEntry, NewAuditEntry } from './audit-entry.js';

function auditFile(dataDir: string, ticketId: string): string {
  assertTicketId(ticketId);
  return join(dataDir, 'audit', `${ticketId}.jsonl`);
}

async function readLines(file: string): Promise<string[]> {
  try {
    return (await readFile(file, 'utf8')).split('\n').filter(Boolean);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Applies the redaction patterns to every string of a JSON-like value (REQ-SEC-09). */
function redactStrings(value: unknown): unknown {
  if (typeof value === 'string') return redact(value).text;
  if (Array.isArray(value)) return value.map(redactStrings);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactStrings(item)]),
    );
  }
  return value;
}

/** The audit log could not write an entry: the run stops (REQ-AUD-06). */
export class AuditWriteError extends Error {
  readonly code = 'AUDIT_WRITE_FAILED';

  constructor(cause: unknown) {
    super('AUDIT_WRITE_FAILED: the audit log could not write the entry', { cause });
    this.name = 'AuditWriteError';
  }
}

/**
 * Append-only audit log, one JSON line per entry in `<dataDir>/audit/<ticketId>.jsonl`
 * (REQ-AUD-01, REQ-AUD-02). It exposes only `append` and `read`.
 */
export class AuditLog {
  private readonly dataDir: string;
  private readonly clock: () => Date;

  constructor(dataDir: string, clock: () => Date = () => new Date()) {
    this.dataDir = dataDir;
    this.clock = clock;
  }

  async append(entry: NewAuditEntry): Promise<AuditEntry> {
    const file = auditFile(this.dataDir, entry.ticketId);
    try {
      await mkdir(dirname(file), { recursive: true });
      const seq = (await readLines(file)).length + 1;
      const written = redactStrings({
        ts: this.clock().toISOString(),
        seq,
        ...entry,
      }) as AuditEntry;
      await appendFile(file, `${JSON.stringify(written)}\n`, { flag: 'a' });
      return written;
    } catch (error) {
      throw new AuditWriteError(error);
    }
  }

  async read(ticketId: string): Promise<AuditEntry[]> {
    const lines = await readLines(auditFile(this.dataDir, ticketId));
    return lines.map((line) => JSON.parse(line) as AuditEntry);
  }
}

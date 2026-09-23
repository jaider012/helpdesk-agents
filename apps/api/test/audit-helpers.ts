import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditLog } from '../src/audit/audit-log.js';

export const TICKET_ID = 'TCK-20260923-101500-dem';

/** An AuditLog over a fresh temporary data folder and a fixed clock. */
export async function tempAuditLog(): Promise<{ log: AuditLog; dataDir: string; file: string }> {
  const dataDir = await mkdtemp(join(tmpdir(), 'helpdesk-audit-'));
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 8, 23, 10, 15, tick++));
  return {
    log: new AuditLog(dataDir, clock),
    dataDir,
    file: join(dataDir, 'audit', `${TICKET_ID}.jsonl`),
  };
}

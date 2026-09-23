import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/audit/audit-log.js';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';

describe('audit.append-only', () => {
  it('exposes only append and read', () => {
    const methods = Object.getOwnPropertyNames(AuditLog.prototype).filter(
      (name) => name !== 'constructor',
    );

    expect(methods.sort()).toEqual(['append', 'read']);
  });

  it('adds lines at the end without modifying the previous ones', async () => {
    const { log, file } = await tempAuditLog();
    await log.append({
      ticketId: TICKET_ID,
      agent: 'triage',
      decision: 'classified',
      reason: 'infra/vpn',
    });
    const before = await readFile(file, 'utf8');

    await log.append({
      ticketId: TICKET_ID,
      agent: 'triage',
      decision: 'routed',
      reason: 'R-T1',
      from: 'triage',
      to: 'diagnostics',
    });
    const after = await readFile(file, 'utf8');

    expect(after.startsWith(before)).toBe(true);
    expect(after.slice(before.length).split('\n').filter(Boolean)).toHaveLength(1);
  });
});

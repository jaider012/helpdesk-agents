import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';

describe('audit.jsonl', () => {
  it('stores each entry as one JSON line in data/audit/<ticketId>.jsonl, with ts and seq', async () => {
    const { log, file } = await tempAuditLog();
    await log.append({
      ticketId: TICKET_ID,
      agent: 'redact',
      decision: 'redacted',
      reason: 'texto redactado',
      data: { counts: { EMAIL: 1 } },
    });
    await log.append({
      ticketId: TICKET_ID,
      agent: 'triage',
      decision: 'transition',
      reason: 'clasificado',
      from: 'NEW',
      to: 'TRIAGED',
    });

    const lines = (await readFile(file, 'utf8')).split('\n');
    expect(lines.at(-1)).toBe('');
    expect(lines.slice(0, -1).map((line) => JSON.parse(line))).toEqual([
      {
        ts: '2026-09-23T10:15:00.000Z',
        ticketId: TICKET_ID,
        seq: 1,
        agent: 'redact',
        decision: 'redacted',
        reason: 'texto redactado',
        data: { counts: { EMAIL: 1 } },
      },
      {
        ts: '2026-09-23T10:15:01.000Z',
        ticketId: TICKET_ID,
        seq: 2,
        agent: 'triage',
        decision: 'transition',
        reason: 'clasificado',
        from: 'NEW',
        to: 'TRIAGED',
      },
    ]);
  });

  it('reads the entries back in write order', async () => {
    const { log } = await tempAuditLog();
    for (const decision of ['ticket_created', 'redacted', 'classified'] as const) {
      await log.append({ ticketId: TICKET_ID, agent: 'runtime', decision, reason: decision });
    }

    expect((await log.read(TICKET_ID)).map(({ seq, decision }) => `${seq}:${decision}`)).toEqual([
      '1:ticket_created',
      '2:redacted',
      '3:classified',
    ]);
  });

  it.each(['../../etc/passwd', 'TCK-1', 'tck-20260923-101500-dem'])(
    'rejects the ticketId %s before touching the file system',
    async (ticketId) => {
      const { log } = await tempAuditLog();

      await expect(
        log.append({ ticketId, agent: 'runtime', decision: 'error', reason: 'x' }),
      ).rejects.toThrow(/invalid ticketId/);
      await expect(log.read(ticketId)).rejects.toThrow(/invalid ticketId/);
    },
  );
});

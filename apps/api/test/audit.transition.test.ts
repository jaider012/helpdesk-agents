import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/audit/audit-log.js';
import { TicketLifecycle } from '../src/tickets/ticket-lifecycle.js';
import { TicketStore } from '../src/tickets/ticket-store.js';
import { realStateMachine } from './lifecycle-helpers.js';
import { ticket } from './ticket-helpers.js';

async function setup() {
  const dataDir = await mkdtemp(join(tmpdir(), 'helpdesk-tickets-'));
  const clock = () => new Date('2026-09-23T10:20:00.000Z');
  const audit = new AuditLog(dataDir, clock);
  const store = new TicketStore(dataDir);
  const lifecycle = new TicketLifecycle(await realStateMachine(), audit, store);
  return { dataDir, audit, store, lifecycle };
}

describe('audit.transition', () => {
  it('records ts, agent, decision, reason, from and to in the same step that persists the new status', async () => {
    const { audit, store, lifecycle } = await setup();
    const candidate = ticket({ status: 'NEW' });

    const saved = await lifecycle.applyTransition(candidate, 'TRIAGED', {
      agent: 'triage',
      reason: 'clasificado como infra/vpn con severidad P3',
    });

    expect(saved.status).toBe('TRIAGED');
    expect(await audit.read(candidate.ticketId)).toEqual([
      {
        ts: '2026-09-23T10:20:00.000Z',
        seq: 1,
        ticketId: candidate.ticketId,
        agent: 'triage',
        decision: 'transition',
        reason: 'clasificado como infra/vpn con severidad P3',
        from: 'NEW',
        to: 'TRIAGED',
      },
    ]);
    expect((await store.read(candidate.ticketId))?.status).toBe('TRIAGED');
  });

  it('logs transition_rejected and keeps the stored status when the transition is invalid', async () => {
    const { audit, store, lifecycle } = await setup();
    const candidate = ticket({ status: 'NEW' });
    await store.save(candidate);

    await expect(
      lifecycle.applyTransition(candidate, 'RESOLVED', {
        agent: 'diagnostics',
        reason: 'resuelto',
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION' }));

    expect(await audit.read(candidate.ticketId)).toMatchObject([
      {
        decision: 'transition_rejected',
        from: 'NEW',
        to: 'RESOLVED',
        data: { code: 'INVALID_TRANSITION' },
      },
    ]);
    expect((await store.read(candidate.ticketId))?.status).toBe('NEW');
  });

  it('writes data/tickets/<ticketId>.json atomically, without the audit and without temporary files', async () => {
    const { dataDir, store } = await setup();
    const candidate = ticket({ status: 'TRIAGED' });

    await store.save(candidate);

    const files = await readdir(join(dataDir, 'tickets'));
    expect(files).toEqual([`${candidate.ticketId}.json`]);
    const stored = JSON.parse(await readFile(join(dataDir, 'tickets', files[0]), 'utf8'));
    expect(stored).not.toHaveProperty('audit');
    expect(stored.status).toBe('TRIAGED');
    expect(await store.read(candidate.ticketId)).toEqual({ ...candidate, audit: [] });
  });

  it('returns undefined for an unknown ticket and rejects an invalid ticketId', async () => {
    const { store } = await setup();

    expect(await store.read('TCK-20260923-101500-zzz')).toBeUndefined();
    await expect(store.read('../secret')).rejects.toThrow(/invalid ticketId/);
    await expect(store.save(ticket({ ticketId: '../secret' }))).rejects.toThrow(/invalid ticketId/);
  });
});

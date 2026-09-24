import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/audit/audit-log.js';
import type { NewAuditEntry } from '../src/audit/audit-entry.js';
import { newTicket, runtime } from './runtime-helpers.js';

describe('escalation.fallback', () => {
  it('builds the package from the template and still reaches ESCALATED when the node raises an unexpected error', async () => {
    let failures = 0;
    // An audit log that breaks the first `escalated` entry with a programming error (not I/O).
    class BrokenOnce extends AuditLog {
      async append(entry: NewAuditEntry) {
        if (entry.decision === 'escalated' && failures++ === 0)
          throw new TypeError('reading properties of undefined');
        return super.append(entry);
      }
    }
    const { graph, audit, store } = await runtime({
      audit: (dataDir, clock) => new BrokenOnce(dataDir, clock),
    });
    const ticketId = 'TCK-20260923-101500-fbk';

    const final = await graph.invoke(newTicket(ticketId, 'La impresora del piso 3 no imprime.'));

    expect(final.status).toBe('ESCALATED');
    expect((await store.read(ticketId))?.status).toBe('ESCALATED');
    expect(final.escalationPackage).toMatchObject({
      reason: 'unknown_category',
      summary: `Caso ${ticketId} escalado. Consulta los hallazgos adjuntos.`,
    });
    expect((await audit.read(ticketId)).map(({ decision }) => decision).slice(-4)).toEqual([
      'error',
      'escalated',
      'transition',
      'node_finished',
    ]);
  });

  it('does not hide an I/O error of the audit log', async () => {
    class Unwritable extends AuditLog {
      async append(entry: NewAuditEntry) {
        if (entry.decision === 'escalated')
          throw Object.assign(new Error('EACCES: permission denied'), {
            code: 'EACCES',
            errno: -13,
          });
        return super.append(entry);
      }
    }
    const { graph } = await runtime({ audit: (dataDir, clock) => new Unwritable(dataDir, clock) });

    await expect(
      graph.invoke(newTicket('TCK-20260923-101500-io1', 'La impresora del piso 3 no imprime.')),
    ).rejects.toThrow(/EACCES/);
  });
});

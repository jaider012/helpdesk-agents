import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newTicket, runtime } from './runtime-helpers.js';

// Permissions do not bind root, so the read-only folder would not fail there.
describe.skipIf(process.getuid?.() === 0)('audit.write-failure', () => {
  it('stops the run with AUDIT_WRITE_FAILED when the audit folder is not writable', async () => {
    const { graph, store, dataDir } = await runtime();
    await mkdir(join(dataDir, 'audit'), { mode: 0o500 });
    const ticketId = 'TCK-20260923-101500-awf';

    await expect(graph.invoke(newTicket(ticketId, 'La VPN no me conecta.'))).rejects.toMatchObject({
      code: 'AUDIT_WRITE_FAILED',
    });
    expect(await store.read(ticketId)).toBeUndefined();
  });
});

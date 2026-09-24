import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newTicket, runtime } from './runtime-helpers.js';

// Permissions do not bind root, so the read-only folder would not fail there.
describe.skipIf(process.getuid?.() === 0)('store.write-failure', () => {
  it('stops the run with STORE_WRITE_FAILED when the tickets folder is not writable', async () => {
    const { graph, audit, dataDir } = await runtime();
    await mkdir(join(dataDir, 'tickets'), { mode: 0o500 });
    const ticketId = 'TCK-20260923-101500-swf';

    await expect(graph.invoke(newTicket(ticketId, 'La VPN no me conecta.'))).rejects.toMatchObject({
      code: 'STORE_WRITE_FAILED',
    });
    const entries = await audit.read(ticketId);
    expect(entries.map(({ decision }) => decision)).toEqual([
      'redacted',
      'classified',
      'transition',
      'error',
    ]);
    expect(entries.at(-1)).toMatchObject({ agent: 'triage', data: { code: 'STORE_WRITE_FAILED' } });
  });
});

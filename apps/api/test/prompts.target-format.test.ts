import { afterEach, describe, expect, it } from 'vitest';
import { readTree } from './pii-helpers.js';
import { postRun, promptApp } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('prompts.target-format', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it.each([
    'x:1; echo INJECTED',
    'VPN-GW.example.internal:443',
    'vpn-gw.example.internal',
    'vpn-gw:443/x',
    'vpn-gw:123456',
  ])('answers 400 before the graph starts when the target is «%s»', async (target) => {
    const { app, store, dataDir } = await promptApp(undefined, { VPN_ALLOWED_TARGETS: target });
    close = () => app.close();
    await app.listen(0);
    const existing = ticket({ status: 'TRIAGED', findings: [], actions: [] });
    await store.save(existing);
    const before = await readTree(dataDir);

    const { status } = await postRun(app, 'run-vpn-diagnostics', {
      ticketId: existing.ticketId,
      target,
    });

    expect(status).toBe(400);
    expect(await readTree(dataDir)).toEqual(before);
  });
});

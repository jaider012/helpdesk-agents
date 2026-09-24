import { afterEach, describe, expect, it } from 'vitest';
import { readTree } from './pii-helpers.js';
import { postRun, promptApp } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('prompts.target-allowlist', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('answers 400 when the target is outside VPN_ALLOWED_TARGETS', async () => {
    const { app, store, dataDir } = await promptApp(undefined, {
      VPN_ALLOWED_TARGETS: 'vpn-gw.example.internal:443, localhost:8443',
    });
    close = () => app.close();
    await app.listen(0);
    const existing = ticket({ status: 'TRIAGED', findings: [], actions: [] });
    await store.save(existing);
    const before = await readTree(dataDir);

    const { status } = await postRun(app, 'run-vpn-diagnostics', {
      ticketId: existing.ticketId,
      target: 'other-host.example.internal:443',
    });

    expect(status).toBe(400);
    expect(await readTree(dataDir)).toEqual(before);
  });

  it('accepts a target of the list, with spaces around the commas', async () => {
    const { app, store } = await promptApp(undefined, {
      VPN_ALLOWED_TARGETS: 'vpn-gw.example.internal:443, localhost:1',
    });
    close = () => app.close();
    await app.listen(0);
    const existing = ticket({ status: 'TRIAGED', findings: [], actions: [] });
    await store.save(existing);

    const { status } = await postRun(app, 'run-vpn-diagnostics', {
      ticketId: existing.ticketId,
      target: 'localhost:1',
    });

    expect(status).toBe(202);
  });

  it('allows the targets of .env.example when VPN_ALLOWED_TARGETS is not set', async () => {
    const { resolveAllowedTargets } = await import('../src/prompts/prompt-runner.js');

    expect([...resolveAllowedTargets({})]).toEqual([
      'vpn-gw.example.internal:443',
      'localhost:8443',
    ]);
  });
});

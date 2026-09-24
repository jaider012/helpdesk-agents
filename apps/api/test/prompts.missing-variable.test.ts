import { afterEach, describe, expect, it } from 'vitest';
import { readTree } from './pii-helpers.js';
import { postRun, promptApp } from './prompt-helpers.js';

describe('prompts.missing-variable', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it.each([
    ['triage-ticket', { ticket: 'La VPN no conecta.' }, ['channel']],
    ['escalate-ticket', { reason: 'revisión' }, ['ticketId']],
    ['run-vpn-diagnostics', undefined, ['ticketId', 'target']],
    ['triage-ticket', { ticket: '   ', channel: 'chat' }, ['ticket']],
  ] as Array<[string, Record<string, string> | undefined, string[]]>)(
    'answers 400 with the missing variables of %s',
    async (name, variables, missing) => {
      const { app, dataDir } = await promptApp();
      close = () => app.close();
      await app.listen(0);

      const { status, body } = await postRun(app, name, variables);

      expect(status).toBe(400);
      expect(body.missing).toEqual(missing);
      expect((await readTree(dataDir)).size).toBe(0);
    },
  );

  it('answers 400 when a variable is not text', async () => {
    const { app } = await promptApp();
    close = () => app.close();
    await app.listen(0);

    const { status } = await postRun(app, 'triage-ticket', {
      ticket: 5,
      channel: 'chat',
    } as unknown as Record<string, string>);

    expect(status).toBe(400);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { postRun, promptApp } from './prompt-helpers.js';
import { readTree } from './pii-helpers.js';

describe('prompts.unknown-ticket', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it.each(['TCK-20260923-101500-zzz', '../../etc/passwd'])(
    'answers 404 and starts nothing when the ticketId «%s» does not exist',
    async (ticketId) => {
      const { app, dataDir } = await promptApp();
      close = () => app.close();
      await app.listen(0);

      const { status } = await postRun(app, 'escalate-ticket', { ticketId, reason: 'revisión' });

      expect(status).toBe(404);
      expect((await readTree(dataDir)).size).toBe(0);
    },
  );
});

import { afterEach, describe, expect, it } from 'vitest';
import { postRun, promptApp } from './prompt-helpers.js';

describe('prompts.not-found', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('answers 404 when the name matches no prompt file', async () => {
    const { app } = await promptApp();
    close = () => app.close();
    await app.listen(0);

    const { status } = await postRun(app, 'reset-password', { ticketId: 'x' });

    expect(status).toBe(404);
  });
});

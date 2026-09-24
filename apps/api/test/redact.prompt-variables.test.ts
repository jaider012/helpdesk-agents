import { afterEach, describe, expect, it } from 'vitest';
import { CLASSIFY_TOOL, DRAFT_TOOL } from '../src/llm/fake-responder.js';
import { leakedValues, readTree, SYNTHETIC_PII } from './pii-helpers.js';
import { promptApp, recordingModel } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('redact.prompt-variables', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('redacts the reason variable before the escalation LLM call and the data folder', async () => {
    const { model, humanOf } = await recordingModel();
    const { app, runner, store, dataDir } = await promptApp(model);
    close = () => app.close();
    const existing = ticket({ status: 'TRIAGED', findings: [], actions: [] });
    await store.save(existing);

    const run = await runner.start('escalate-ticket', {
      ticketId: existing.ticketId,
      reason: `Lo pidió ${SYNTHETIC_PII.email}, tel ${SYNTHETIC_PII.phone}`,
    });
    await run.done;

    expect(humanOf(DRAFT_TOOL)).toContain('Lo pidió [EMAIL], tel [PHONE]');
    for (const content of (await readTree(dataDir)).values())
      expect(leakedValues(content)).toEqual([]);
  });

  it('redacts the ticket variable before the triage LLM call', async () => {
    const { model, humanOf } = await recordingModel();
    const { app, runner } = await promptApp(model);
    close = () => app.close();

    const run = await runner.start('triage-ticket', {
      ticket: `Soy ${SYNTHETIC_PII.email} y la VPN no conecta.`,
      channel: 'email',
    });
    await run.done;

    expect(humanOf(CLASSIFY_TOOL)).toContain('Soy [EMAIL] y la VPN no conecta.');
    expect(leakedValues(humanOf(CLASSIFY_TOOL))).toEqual([]);
  });
});

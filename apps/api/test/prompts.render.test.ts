import { afterEach, describe, expect, it } from 'vitest';
import { CLASSIFY_TOOL, DRAFT_TOOL } from '../src/llm/fake-responder.js';
import { promptApp, recordingModel } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

describe('prompts.render', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('renders triage-ticket with the variables and sends it to the triage LLM call', async () => {
    const { model, humanOf } = await recordingModel();
    const { app, runner } = await promptApp(model);
    close = () => app.close();

    const run = await runner.start('triage-ticket', {
      ticket: 'La VPN no me conecta desde esta mañana.',
      channel: 'chat',
    });
    await run.done;

    const human = humanOf(CLASSIFY_TOOL);
    expect(human).toContain('Clasifica un ticket nuevo que llegó por el canal chat.');
    expect(human).toContain('La VPN no me conecta desde esta mañana.');
    expect(human).not.toContain('${input:');
  });

  it('renders escalate-ticket and sends it to the escalation drafting call', async () => {
    const { model, humanOf } = await recordingModel();
    const { app, runner, store } = await promptApp(model);
    close = () => app.close();
    const existing = ticket({ status: 'TRIAGED', findings: [], actions: [] });
    await store.save(existing);

    const run = await runner.start('escalate-ticket', {
      ticketId: existing.ticketId,
      reason: 'El área pidió revisarlo con prioridad',
    });
    await run.done;

    const human = humanOf(DRAFT_TOOL);
    expect(human).toContain(`Escala el ticket ${existing.ticketId} a petición del operador.`);
    expect(human).toContain('El área pidió revisarlo con prioridad');
    expect(human).not.toContain('${input:');
  });
});

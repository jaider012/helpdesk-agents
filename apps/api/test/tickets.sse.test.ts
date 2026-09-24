import { loadSpec } from 'agent-spec';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { createFakeResponder } from '../src/llm/fake-responder.js';
import { templatesFromBundle } from '../src/messages/templates.js';
import { REPO_ROOT } from './lifecycle-helpers.js';
import { postJson, promptApp } from './prompt-helpers.js';
import { ticket } from './ticket-helpers.js';

type App = Awaited<ReturnType<typeof promptApp>>['app'];

interface SseEvent {
  event?: string;
  id?: string;
  data: unknown;
}

/** Opens `GET /tickets/:id/events`; `events()` reads the stream until the server ends it. */
async function openEvents(app: App, ticketId: string) {
  const response = await fetch(`${await app.getUrl()}/tickets/${ticketId}/events`);
  const events = async (): Promise<SseEvent[]> =>
    (await response.text())
      .split('\n\n')
      .map((frame) => frame.split('\n').filter(Boolean))
      .filter((lines) => lines.some((line) => line.startsWith('data:')))
      .map((lines) => {
        const field = (name: string) =>
          lines.find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2);
        return { event: field('event'), id: field('id'), data: JSON.parse(field('data') ?? '') };
      });
  return { response, events };
}

/** The fake model of the runtime, held before its first answer until `release()`. */
async function gatedModel() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const respond = createFakeResponder(templatesFromBundle(await loadSpec(REPO_ROOT)));
  const model = new FakeChatModel(async (messages, tools) => {
    await gate;
    return respond(messages, tools);
  });
  return { model, release };
}

describe('tickets.sse', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('streams every audit entry of a running graph and ends with done and the final status', async () => {
    const { model, release } = await gatedModel();
    const { app, audit, store } = await promptApp(model);
    close = () => app.close();
    await app.listen(0);
    const { body } = await postJson(app, '/tickets', {
      text: 'Desde esta mañana la VPN no me conecta desde casa.',
      channel: 'portal',
    });
    const ticketId = String(body.ticketId);

    // The ticket is not stored until triage classifies it; the stream opens on the running graph.
    const { response, events } = await openEvents(app, ticketId);
    release();
    const received = await events();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const written = await audit.read(ticketId);
    const audited = received.filter(({ event }) => event === 'audit');
    expect(audited.map(({ data }) => data)).toEqual(written);
    expect(audited.map(({ id }) => id)).toEqual(written.map(({ seq }) => String(seq)));
    expect(written.map(({ decision }) => decision)).toEqual(
      expect.arrayContaining(['prompt_run', 'routed', 'transition']),
    );
    const final = (await store.read(ticketId))?.status;
    expect(final).toMatch(/^(RESOLVED|ESCALATED)$/);
    expect(received.at(-1)).toMatchObject({ event: 'done', data: { status: final } });
  });

  it('replays the audit and sends done at once for a ticket without a running graph', async () => {
    const { app, audit, store } = await promptApp();
    close = () => app.close();
    await app.listen(0);
    const stored = ticket({ status: 'WAITING_USER' });
    await store.save(stored);
    await audit.append({
      ticketId: stored.ticketId,
      agent: 'diagnostics',
      decision: 'transition',
      reason: 'the issue type is unknown',
      from: 'IN_PROGRESS',
      to: 'WAITING_USER',
    });

    const { events } = await openEvents(app, stored.ticketId);

    expect(await events()).toEqual([
      { event: 'audit', id: '1', data: (await audit.read(stored.ticketId))[0] },
      { event: 'done', id: expect.any(String), data: { status: 'WAITING_USER' } },
    ]);
  });

  it.each(['TCK-20260923-101500-zzz', 'not-a-ticket'])(
    'answers 404 for the unknown ticket %s',
    async (ticketId) => {
      const { app } = await promptApp();
      close = () => app.close();
      await app.listen(0);

      const { response } = await openEvents(app, ticketId);

      expect(response.status).toBe(404);
    },
  );
});

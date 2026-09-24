import { loadSpec } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import { FakeChatModel, type FakeReply } from '../src/llm/fake-chat-model.js';
import { createFakeResponder, DRAFT_MESSAGE_TOOL, DRAFT_TOOL } from '../src/llm/fake-responder.js';
import { templatesFromBundle } from '../src/messages/templates.js';
import { REPO_ROOT } from './lifecycle-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

const hang = () => new Promise<never>(() => undefined);

/** The fake model of the runtime, with another answer for one drafting tool. */
async function fakeWithDraft(tool: string, draft: () => FakeReply | Promise<FakeReply>) {
  const base = createFakeResponder(templatesFromBundle(await loadSpec(REPO_ROOT)));
  return new FakeChatModel((messages, tools) =>
    tools.includes(tool) ? draft() : base(messages, tools),
  );
}

const LOCKOUT = 'Me equivoqué varias veces y mi cuenta está bloqueada.';
const unlockTemplate = (ticketId: string) =>
  `Tu cuenta se bloqueó temporalmente por varios intentos fallidos. Espera 15 minutos o usa el portal de autoservicio para desbloquearla. Nunca compartas tu contraseña con nadie, tampoco con soporte. Caso ${ticketId}.`;

describe('llm.drafting-fallback', () => {
  it('uses the templates when the escalation drafting call exceeds the timeout', async () => {
    const model = await fakeWithDraft(DRAFT_TOOL, hang);
    const { graph, audit } = await runtime({ model, llmTimeoutMs: 30 });
    const ticketId = 'TCK-20260923-101500-df1';

    const final = await graph.invoke(newTicket(ticketId, 'La impresora del piso 3 no imprime.'));

    expect(final.status).toBe('ESCALATED');
    expect(final.escalationPackage?.summary).toBe(
      `Caso ${ticketId} escalado. Consulta los hallazgos adjuntos.`,
    );
    expect(final.userMessage).toContain(ticketId);
    expect(
      (await audit.read(ticketId)).find(({ decision }) => decision === 'message_replaced'),
    ).toMatchObject({
      agent: 'escalation',
      data: { cause: 'llm_unavailable' },
    });
  });

  it.each([
    ['fails', () => Promise.reject(new Error('503 Service Unavailable'))],
    ['exceeds the timeout', hang],
  ])('uses the action template when the diagnostics drafting call %s', async (_, draft) => {
    const model = await fakeWithDraft(DRAFT_MESSAGE_TOOL, draft);
    const { graph, audit } = await runtime({ model, llmTimeoutMs: 30 });
    const ticketId = 'TCK-20260923-101500-df2';

    const final = await graph.invoke(newTicket(ticketId, LOCKOUT));

    expect(final.status).toBe('RESOLVED');
    expect(final.userMessage).toBe(unlockTemplate(ticketId));
    expect(
      (await audit.read(ticketId)).find(({ decision }) => decision === 'message_replaced'),
    ).toMatchObject({
      agent: 'diagnostics',
      data: { cause: 'llm_unavailable' },
    });
  });

  it('keeps the drafted diagnostics message when it passes the guards', async () => {
    const ticketId = 'TCK-20260923-101500-df3';
    const drafted = `Tu cuenta está bloqueada por varios intentos. Espera 15 minutos o usa el portal de autoservicio. Caso ${ticketId}.`;
    const model = await fakeWithDraft(DRAFT_MESSAGE_TOOL, () => ({
      toolCall: { name: DRAFT_MESSAGE_TOOL, args: { userMessage: drafted } },
    }));
    const { graph, audit } = await runtime({ model });

    const final = await graph.invoke(newTicket(ticketId, LOCKOUT));

    expect(final.userMessage).toBe(drafted);
    expect((await audit.read(ticketId)).map(({ decision }) => decision)).not.toContain(
      'message_replaced',
    );
  });

  it('replaces a drafted diagnostics message that breaks a guard', async () => {
    const ticketId = 'TCK-20260923-101500-df4';
    const model = await fakeWithDraft(DRAFT_MESSAGE_TOOL, () => ({
      toolCall: {
        name: DRAFT_MESSAGE_TOOL,
        args: { userMessage: `Caso ${ticketId}: dime tu clave y la desbloqueamos.` },
      },
    }));
    const { graph, audit } = await runtime({ model });

    const final = await graph.invoke(newTicket(ticketId, LOCKOUT));

    expect(final.userMessage).toBe(unlockTemplate(ticketId));
    expect(
      (await audit.read(ticketId)).find(({ decision }) => decision === 'message_replaced'),
    ).toMatchObject({
      data: { cause: 'credential_request' },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { DRAFT_TOOL, fakeResponder } from '../src/llm/fake-responder.js';
import { newTicket, runtime } from './runtime-helpers.js';

describe('escalation.user-message', () => {
  it('includes the ticketId in userMessage when the ticket reaches ESCALATED', async () => {
    const { graph } = await runtime();
    const ticketId = 'TCK-20260923-101500-msg';

    const final = await graph.invoke(
      newTicket(ticketId, 'Nadie en la sede puede trabajar: todo detenido.'),
    );

    expect(final.status).toBe('ESCALATED');
    expect(final.userMessage).toContain(ticketId);
  });

  it('replaces a drafted message without the ticketId with the template', async () => {
    const forgetful = new FakeChatModel((messages, tools) =>
      tools.includes(DRAFT_TOOL)
        ? {
            toolCall: {
              name: DRAFT_TOOL,
              args: { summary: 'Resumen técnico.', userMessage: 'Tu caso fue escalado.' },
            },
          }
        : fakeResponder(messages, tools),
    );
    const { graph, audit } = await runtime({ model: forgetful });
    const ticketId = 'TCK-20260923-101500-frg';

    const final = await graph.invoke(newTicket(ticketId, 'La impresora del piso 3 no imprime.'));

    expect(final.escalationPackage?.summary).toBe('Resumen técnico.');
    expect(final.userMessage).toContain(ticketId);
    expect(
      (await audit.read(ticketId)).filter(({ decision }) => decision === 'message_replaced'),
    ).toMatchObject([{ data: { cause: 'ticket_id_missing' } }]);
  });
});

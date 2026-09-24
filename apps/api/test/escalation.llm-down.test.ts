import { describe, expect, it } from 'vitest';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { DRAFT_TOOL, fakeResponder } from '../src/llm/fake-responder.js';
import { newTicket, runtime } from './runtime-helpers.js';

// Classifies as usual, but the provider is down when escalation drafts its texts.
const downWhenDrafting = new FakeChatModel((messages, tools) => {
  if (tools.includes(DRAFT_TOOL)) throw new Error('503 Service Unavailable');
  return fakeResponder(messages, tools);
});

describe('escalation.llm-down', () => {
  it('builds the escalation package from the deterministic template while the LLM is unavailable', async () => {
    const { graph, audit } = await runtime({ model: downWhenDrafting });
    const ticketId = 'TCK-20260923-101500-dwn';

    const final = await graph.invoke(newTicket(ticketId, 'La impresora del piso 3 no imprime.'));

    expect(final.status).toBe('ESCALATED');
    expect(final.escalationPackage?.summary).toBe(
      `Caso ${ticketId} escalado. Consulta los hallazgos adjuntos.`,
    );
    expect(final.userMessage).toBe(
      `Tu caso ${ticketId} quedó asignado a un equipo especialista, que te contactará dentro del plazo de atención acordado.`,
    );
    expect(
      (await audit.read(ticketId)).filter(({ decision }) => decision === 'message_replaced'),
    ).toMatchObject([{ agent: 'escalation', data: { cause: 'llm_unavailable' } }]);
  });
});

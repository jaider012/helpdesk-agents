import type { BaseMessage } from '@langchain/core/messages';
import { loadSpec } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import type { GraphState } from '../src/graph/state.js';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { createFakeResponder, DRAFT_TOOL } from '../src/llm/fake-responder.js';
import { templatesFromBundle } from '../src/messages/templates.js';
import { REPO_ROOT } from './lifecycle-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

/** The fake model of the runtime, keeping the messages of each escalation draft. */
async function recordingModel() {
  const drafts: BaseMessage[][] = [];
  const respond = createFakeResponder(templatesFromBundle(await loadSpec(REPO_ROOT)));
  const model = new FakeChatModel((messages, tools) => {
    if (tools.includes(DRAFT_TOOL)) drafts.push(messages);
    return respond(messages, tools);
  });
  return { model, drafts };
}

const text = (message: BaseMessage | undefined) => String(message?.content ?? '');
const envelopeOf = (messages: BaseMessage[]) =>
  JSON.parse(text(messages.at(-1)).split('\n\n').at(-1) ?? '') as Record<string, unknown>;

const PROVISIONING_PROMPT =
  'Envía la solicitud de aprobación a escalamiento usando solo `ticketId`, `category`, `severity`, `entities` y `findings`.';
const TRIAGE_PROMPT =
  'Escala este ticket usando solo `ticketId`, `category`, `severity`, `entities` y `findings`, e indica el motivo del enrutamiento.';

describe('graph.handoff-context', () => {
  it('passes to the target agent only ticketId, category, severity, entities and findings', async () => {
    const { model, drafts } = await recordingModel();
    const { graph } = await runtime({ model });
    const ticketId = 'TCK-20260923-101500-hc1';
    const rawText = 'La impresora del piso 3 no imprime desde el lunes.';

    const final = await graph.invoke(newTicket(ticketId, rawText));

    expect(drafts).toHaveLength(1);
    const [messages] = drafts as [BaseMessage[]];
    expect(messages.map(text).join('\n')).not.toContain(final.redactedText);
    const { context, route } = envelopeOf(messages) as {
      context: Record<string, unknown>;
      route: Record<string, unknown>;
    };
    expect(Object.keys(context).sort()).toEqual([
      'category',
      'entities',
      'findings',
      'severity',
      'ticketId',
    ]);
    expect(context).toMatchObject({ ticketId, category: 'unknown', findings: [] });
    expect(route).toEqual(final.lastRoute);
  });

  it('sends the prompt of the handoff declared by the source agent', async () => {
    const { model, drafts } = await recordingModel();
    const { graph } = await runtime({ model });

    await graph.invoke(newTicket('TCK-20260923-101500-hc2', 'La impresora del piso 3 no imprime.'));

    expect(text(drafts[0]?.at(-1)).startsWith(`${TRIAGE_PROMPT}\n\n`)).toBe(true);
  });

  it('takes the prompt from provisioning.agent.md when provisioning hands off to escalation', async () => {
    const { model, drafts } = await recordingModel();
    const approvalRequired = (state: GraphState) => ({
      lastRoute: {
        from: 'provisioning' as const,
        to: 'escalation' as const,
        rule: 'R-P1',
        reason: 'approval_required' as const,
      },
      entities: state.entities,
    });
    const { graph } = await runtime({ model, override: { provisioning: approvalRequired } });

    await graph.invoke(
      newTicket(
        'TCK-20260923-101500-hc3',
        'Necesito acceso de lectura a la carpeta finanzas-2026 para preparar el cierre del mes.',
      ),
    );

    const messages = drafts[0] ?? [];
    expect(text(messages.at(-1)).startsWith(`${PROVISIONING_PROMPT}\n\n`)).toBe(true);
    expect(envelopeOf(messages).route).toMatchObject({ reason: 'approval_required' });
    expect(JSON.stringify(envelopeOf(messages))).not.toContain('approvalRequest');
  });
});

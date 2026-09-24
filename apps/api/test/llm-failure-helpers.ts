import { loadSpec } from 'agent-spec';
import { FakeChatModel, type FakeReply } from '../src/llm/fake-chat-model.js';
import { CLASSIFY_TOOL, createFakeResponder, DRAFT_TOOL } from '../src/llm/fake-responder.js';
import { templatesFromBundle } from '../src/messages/templates.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

/** The fake model of the runtime, with another answer for the triage classification. */
export async function fakeWithClassify(classify: () => FakeReply | Promise<FakeReply>) {
  const base = createFakeResponder(templatesFromBundle(await loadSpec(REPO_ROOT)));
  return new FakeChatModel((messages, tools) =>
    tools.includes(CLASSIFY_TOOL) ? classify() : base(messages, tools),
  );
}

/** The fake model of the runtime, drafting this user message for escalation. */
export async function fakeWithDraftedMessage(userMessage: (ticketId: string) => string) {
  const base = createFakeResponder(templatesFromBundle(await loadSpec(REPO_ROOT)));
  return new FakeChatModel((messages, tools) => {
    const reply = base(messages, tools);
    if (!tools.includes(DRAFT_TOOL) || typeof reply === 'string' || !reply.toolCall) return reply;
    const ticketId = String((reply.toolCall.args.summary as string).match(/TCK-[\w-]+/)?.[0]);
    const args = { ...reply.toolCall.args, userMessage: userMessage(ticketId) };
    return { toolCall: { name: DRAFT_TOOL, args } };
  });
}

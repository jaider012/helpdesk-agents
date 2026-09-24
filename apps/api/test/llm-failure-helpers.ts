import { loadSpec } from 'agent-spec';
import { FakeChatModel, type FakeReply } from '../src/llm/fake-chat-model.js';
import { CLASSIFY_TOOL, createFakeResponder } from '../src/llm/fake-responder.js';
import { templatesFromBundle } from '../src/messages/templates.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

/** The fake model of the runtime, with another answer for the triage classification. */
export async function fakeWithClassify(classify: () => FakeReply | Promise<FakeReply>) {
  const base = createFakeResponder(templatesFromBundle(await loadSpec(REPO_ROOT)));
  return new FakeChatModel((messages, tools) =>
    tools.includes(CLASSIFY_TOOL) ? classify() : base(messages, tools),
  );
}

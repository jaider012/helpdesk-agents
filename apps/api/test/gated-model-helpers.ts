import { loadSpec } from 'agent-spec';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { createFakeResponder } from '../src/llm/fake-responder.js';
import { templatesFromBundle } from '../src/messages/templates.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

/** The fake model of the runtime, held before its first answer until `release()`. */
export async function gatedModel() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const respond = createFakeResponder(templatesFromBundle(await loadSpec(REPO_ROOT)));
  const model = new FakeChatModel(async (messages, tools) => {
    await gate;
    return respond(messages, tools);
  });
  return { model, release };
}

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { FakeChatModel } from './fake-chat-model.js';
import type { FakeResponder } from './fake-chat-model.js';
import { fakeResponder } from './fake-responder.js';

export type LlmProvider = 'fake';

export interface ChatModelSelection {
  provider: LlmProvider;
  model: BaseChatModel;
  /** Set when the api falls back to the fake model outside tests. */
  warning?: string;
}

export const NO_PROVIDER_WARNING =
  'No LLM provider variables are set: the api runs on the deterministic fake model';

export const DEFAULT_LLM_TIMEOUT_MS = 30_000;

/** The timeout of each LLM call: `LLM_TIMEOUT_MS` when it is a positive integer, 30 s otherwise. */
export function resolveLlmTimeoutMs(env: Record<string, string | undefined>): number {
  const value = Number(env.LLM_TIMEOUT_MS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_LLM_TIMEOUT_MS;
}

/** Chooses the chat model from the environment variables, in the order of design §12.3. */
export function selectChatModel(
  env: Record<string, string | undefined>,
  responder: FakeResponder = fakeResponder,
): ChatModelSelection {
  // Tests always run on the deterministic fake model, whatever else is configured (REQ-LLM-04).
  if (env.NODE_ENV === 'test') return { provider: 'fake', model: new FakeChatModel(responder) };
  // Without a complete provider configuration the demo still starts, without secrets (REQ-LLM-03).
  return {
    provider: 'fake',
    model: new FakeChatModel(responder),
    warning: NO_PROVIDER_WARNING,
  };
}

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { FakeChatModel } from './fake-chat-model.js';

export type LlmProvider = 'fake';

export interface ChatModelSelection {
  provider: LlmProvider;
  model: BaseChatModel;
  /** Set when the api falls back to the fake model outside tests. */
  warning?: string;
}

export const NO_PROVIDER_WARNING =
  'No LLM provider variables are set: the api runs on the deterministic fake model';

/** Chooses the chat model from the environment variables, in the order of design §12.3. */
export function selectChatModel(env: Record<string, string | undefined>): ChatModelSelection {
  // Tests always run on the deterministic fake model, whatever else is configured (REQ-LLM-04).
  if (env.NODE_ENV === 'test') return { provider: 'fake', model: new FakeChatModel() };
  // Without a complete provider configuration the demo still starts, without secrets (REQ-LLM-03).
  return { provider: 'fake', model: new FakeChatModel(), warning: NO_PROVIDER_WARNING };
}

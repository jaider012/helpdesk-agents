import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AzureChatOpenAI, ChatOpenAI } from '@langchain/openai';
import { FakeChatModel } from './fake-chat-model.js';
import type { FakeResponder } from './fake-chat-model.js';
import { fakeResponder } from './fake-responder.js';

export type LlmProvider = 'azure' | 'deepseek' | 'lmstudio' | 'fake';

export interface ChatModelSelection {
  provider: LlmProvider;
  model: BaseChatModel;
  /** Set when the api falls back to the fake model outside tests. */
  warning?: string;
}

export const NO_PROVIDER_WARNING =
  'No LLM provider variables are set: the api runs on the deterministic fake model';

export const DEFAULT_LLM_TIMEOUT_MS = 30_000;

/** Upper bound of each answer of a real model: a draft never generates until the timeout. */
export const LLM_MAX_TOKENS = 1024;

export const DEFAULT_AZURE_OPENAI_API_VERSION = '2024-10-21';

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

/** LM Studio ignores the key, but the OpenAI client requires one. */
const LMSTUDIO_PLACEHOLDER_KEY = 'lm-studio';

/**
 * DeepSeek through its OpenAI-compatible API. It does not accept `json_schema`, which ChatOpenAI
 * uses by default, so structured outputs go through function calling (design §12.3).
 */
function deepSeekModel(fields: ConstructorParameters<typeof ChatOpenAI>[0]): ChatOpenAI {
  const model = new ChatOpenAI(fields);
  const withStructuredOutput = model.withStructuredOutput.bind(model);
  // A wrapper of the instance: the generic overloads of the method cannot be overridden as such.
  model.withStructuredOutput = ((schema, config) =>
    withStructuredOutput(schema, {
      ...config,
      method: 'functionCalling',
    })) as ChatOpenAI['withStructuredOutput'];
  return model;
}

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
  // A client is only built with all of its variables (REQ-LLM-01).
  if (env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_DEPLOYMENT) {
    return {
      provider: 'azure',
      model: new AzureChatOpenAI({
        azureOpenAIEndpoint: env.AZURE_OPENAI_ENDPOINT,
        azureOpenAIApiKey: env.AZURE_OPENAI_API_KEY,
        azureOpenAIApiDeploymentName: env.AZURE_OPENAI_DEPLOYMENT,
        azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_OPENAI_API_VERSION,
        temperature: 0,
        maxTokens: LLM_MAX_TOKENS,
      }),
    };
  }
  if (env.DEEPSEEK_API_KEY) {
    return {
      provider: 'deepseek',
      model: deepSeekModel({
        apiKey: env.DEEPSEEK_API_KEY,
        model: env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
        configuration: { baseURL: DEEPSEEK_BASE_URL },
        temperature: 0,
        maxTokens: LLM_MAX_TOKENS,
      }),
    };
  }
  if (env.LMSTUDIO_BASE_URL && env.LMSTUDIO_MODEL) {
    return {
      provider: 'lmstudio',
      // Structured outputs keep the default json_schema, which LM Studio decodes with a grammar.
      model: new ChatOpenAI({
        apiKey: LMSTUDIO_PLACEHOLDER_KEY,
        model: env.LMSTUDIO_MODEL,
        configuration: { baseURL: env.LMSTUDIO_BASE_URL },
        temperature: 0,
        maxTokens: LLM_MAX_TOKENS,
        // A reasoning model (qwen3.5) would otherwise think first and leave the answer empty.
        modelKwargs: { reasoning_effort: 'none' },
      }),
    };
  }
  // Without a complete provider configuration the demo still starts, without secrets (REQ-LLM-03).
  return {
    provider: 'fake',
    model: new FakeChatModel(responder),
    warning: NO_PROVIDER_WARNING,
  };
}

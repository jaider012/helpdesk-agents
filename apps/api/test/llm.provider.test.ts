import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { AzureChatOpenAI, ChatOpenAI } from '@langchain/openai';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { CHAT_MODEL, LLM_PROVIDER, LlmModule } from '../src/llm/llm.module.js';
import { NO_PROVIDER_WARNING, selectChatModel } from '../src/llm/provider.js';

/** Synthetic Azure OpenAI configuration (design §12.5): no request is ever sent. */
const AZURE = {
  AZURE_OPENAI_ENDPOINT: 'https://example-resource.openai.azure.com',
  AZURE_OPENAI_API_KEY: 'synthetic-azure-key',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-deployment-name',
};

const DEEPSEEK = { DEEPSEEK_API_KEY: 'synthetic-deepseek-key' };

/** Replaces `fetch` with a canned chat completion and keeps each request: nothing leaves the test. */
function captureRequests(message: Record<string, unknown>) {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const completion = {
      id: 'chatcmpl-synthetic',
      object: 'chat.completion',
      created: 0,
      model: 'synthetic',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', ...message } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    };
    return new Response(JSON.stringify(completion), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return requests;
}

const Classification = z.object({ category: z.string() });

describe('llm.provider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['no LLM variables', {}],
    [
      'an incomplete Azure OpenAI configuration',
      { AZURE_OPENAI_ENDPOINT: 'https://example-resource.openai.azure.com' },
    ],
    ['an empty DeepSeek key', { DEEPSEEK_API_KEY: '' }],
  ])('falls back to the fake model with a warning when there are %s', (_, variables) => {
    const selection = selectChatModel({ NODE_ENV: 'production', ...variables });

    expect(selection.provider).toBe('fake');
    expect(selection.model).toBeInstanceOf(FakeChatModel);
    expect(selection.warning).toBe(NO_PROVIDER_WARNING);
  });

  it('uses AzureChatOpenAI with the deployment when the three Azure OpenAI variables are set', () => {
    const selection = selectChatModel({ NODE_ENV: 'production', ...AZURE });

    expect(selection.provider).toBe('azure');
    expect(selection.warning).toBeUndefined();
    expect(selection.model).toBeInstanceOf(AzureChatOpenAI);
    expect(selection.model).toMatchObject({
      azureOpenAIEndpoint: 'https://example-resource.openai.azure.com',
      azureOpenAIApiDeploymentName: 'gpt-deployment-name',
      azureOpenAIApiVersion: '2024-10-21',
      temperature: 0,
      maxTokens: 1024,
    });
  });

  it('takes the Azure OpenAI API version from AZURE_OPENAI_API_VERSION', () => {
    const selection = selectChatModel({
      NODE_ENV: 'production',
      ...AZURE,
      AZURE_OPENAI_API_VERSION: '2025-01-01-preview',
    });

    expect(selection.model).toMatchObject({ azureOpenAIApiVersion: '2025-01-01-preview' });
  });

  it('starts the Nest LLM module with Azure OpenAI and reports it', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const [name, value] of Object.entries(AZURE)) vi.stubEnv(name, value);

    const moduleRef = await Test.createTestingModule({ imports: [LlmModule] }).compile();

    expect(moduleRef.get(LLM_PROVIDER)).toBe('azure');
    expect(moduleRef.get(CHAT_MODEL)).toBeInstanceOf(AzureChatOpenAI);
  });

  it('uses DeepSeek through ChatOpenAI when the Azure OpenAI variables are absent', () => {
    const selection = selectChatModel({ NODE_ENV: 'production', ...DEEPSEEK });

    expect(selection.provider).toBe('deepseek');
    expect(selection.warning).toBeUndefined();
    expect(selection.model).toBeInstanceOf(ChatOpenAI);
    expect(selection.model).not.toBeInstanceOf(AzureChatOpenAI);
    expect(selection.model).toMatchObject({
      model: 'deepseek-chat',
      temperature: 0,
      maxTokens: 1024,
    });
  });

  it('takes the DeepSeek model from DEEPSEEK_MODEL', () => {
    const selection = selectChatModel({
      NODE_ENV: 'production',
      ...DEEPSEEK,
      DEEPSEEK_MODEL: 'deepseek-reasoner',
    });

    expect(selection.model).toMatchObject({ model: 'deepseek-reasoner' });
  });

  it('prefers Azure OpenAI over DeepSeek', () => {
    expect(selectChatModel({ NODE_ENV: 'production', ...AZURE, ...DEEPSEEK }).provider).toBe(
      'azure',
    );
  });

  it('sends the structured outputs to DeepSeek as a function call', async () => {
    const requests = captureRequests({
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'classify_ticket', arguments: '{"category":"infra"}' },
        },
      ],
    });
    const { model } = selectChatModel({ NODE_ENV: 'production', ...DEEPSEEK });

    const output = await model
      .withStructuredOutput(Classification, { name: 'classify_ticket' })
      .invoke('La VPN no conecta.');

    expect(output).toEqual({ category: 'infra' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://api.deepseek.com/chat/completions');
    expect(requests[0]?.body).toMatchObject({
      model: 'deepseek-chat',
      max_tokens: 1024,
      tools: [{ type: 'function', function: { name: 'classify_ticket' } }],
    });
    expect(requests[0]?.body).not.toHaveProperty('response_format');
  });

  it('does not warn in test mode', () => {
    expect(selectChatModel({ NODE_ENV: 'test' }).warning).toBeUndefined();
  });

  it('starts the Nest LLM module with the fake model and logs the warning', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const name of [
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_DEPLOYMENT',
      'DEEPSEEK_API_KEY',
    ]) {
      vi.stubEnv(name, '');
    }
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({ imports: [LlmModule] }).compile();

    expect(moduleRef.get(LLM_PROVIDER)).toBe('fake');
    expect(moduleRef.get(CHAT_MODEL)).toBeInstanceOf(FakeChatModel);
    expect(warn).toHaveBeenCalledWith(NO_PROVIDER_WARNING);
  });
});

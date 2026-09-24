import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { AzureChatOpenAI } from '@langchain/openai';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { CHAT_MODEL, LLM_PROVIDER, LlmModule } from '../src/llm/llm.module.js';
import { NO_PROVIDER_WARNING, selectChatModel } from '../src/llm/provider.js';

/** Synthetic Azure OpenAI configuration (design §12.5): no request is ever sent. */
const AZURE = {
  AZURE_OPENAI_ENDPOINT: 'https://example-resource.openai.azure.com',
  AZURE_OPENAI_API_KEY: 'synthetic-azure-key',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-deployment-name',
};

describe('llm.provider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ['no LLM variables', {}],
    [
      'an incomplete Azure OpenAI configuration',
      { AZURE_OPENAI_ENDPOINT: 'https://example-resource.openai.azure.com' },
    ],
    ['an empty Anthropic key', { ANTHROPIC_API_KEY: '' }],
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

  it('does not warn in test mode', () => {
    expect(selectChatModel({ NODE_ENV: 'test' }).warning).toBeUndefined();
  });

  it('starts the Nest LLM module with the fake model and logs the warning', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const name of [
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_DEPLOYMENT',
      'ANTHROPIC_API_KEY',
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

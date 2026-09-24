import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { CHAT_MODEL, LLM_PROVIDER, LlmModule } from '../src/llm/llm.module.js';
import { NO_PROVIDER_WARNING, selectChatModel } from '../src/llm/provider.js';

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

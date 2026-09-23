import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { CHAT_MODEL, LLM_PROVIDER, LlmModule } from '../src/llm/llm.module.js';
import { selectChatModel } from '../src/llm/provider.js';

// Synthetic values: the provider variables are set but must be ignored in test mode.
const PROVIDER_VARIABLES = {
  AZURE_OPENAI_ENDPOINT: 'https://example-resource.openai.azure.com',
  AZURE_OPENAI_API_KEY: 'synthetic-azure-key',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-deployment-name',
  ANTHROPIC_API_KEY: 'synthetic-anthropic-key',
};

describe('llm.test-mode', () => {
  it('selects the deterministic fake model while NODE_ENV is test, even with provider variables', () => {
    const selection = selectChatModel({ NODE_ENV: 'test', ...PROVIDER_VARIABLES });

    expect(selection.provider).toBe('fake');
    expect(selection.model).toBeInstanceOf(FakeChatModel);
  });

  it('injects the fake model through the Nest LLM module under the test runner', async () => {
    expect(process.env.NODE_ENV).toBe('test');
    const moduleRef = await Test.createTestingModule({ imports: [LlmModule] }).compile();

    expect(moduleRef.get(CHAT_MODEL)).toBeInstanceOf(FakeChatModel);
    expect(moduleRef.get(LLM_PROVIDER)).toBe('fake');
  });

  it('answers the same input with the same output', async () => {
    const { model } = selectChatModel({ NODE_ENV: 'test' });
    const first = await model.invoke('Mi VPN no conecta.');
    const second = await model.invoke('Mi VPN no conecta.');

    expect(second.content).toEqual(first.content);
  });
});

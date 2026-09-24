import { BaseChatModel, type BindToolsInput } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk, type BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';

export interface FakeReply {
  content?: string;
  toolCall?: { name: string; args: Record<string, unknown> };
}

/** Decides the answer from the messages and the names of the bound tools. */
export type FakeResponder = (messages: BaseMessage[], tools: string[]) => string | FakeReply;

function toolName(tool: BindToolsInput): string {
  const candidate = tool as { name?: unknown; function?: { name?: unknown } };
  return String(candidate.function?.name ?? candidate.name ?? '');
}

/**
 * Deterministic chat model (design §12.3): the same messages always produce the same answer and
 * nothing leaves the process. Tests use it always (REQ-LLM-04). It supports tool binding, which
 * `withStructuredOutput` needs.
 */
export class FakeChatModel extends BaseChatModel {
  private readonly respond: FakeResponder;
  private readonly boundTools: string[];

  constructor(respond: FakeResponder = () => '', boundTools: string[] = []) {
    super({});
    this.respond = respond;
    this.boundTools = boundTools;
  }

  _llmType(): string {
    return 'fake';
  }

  bindTools(tools: BindToolsInput[]): FakeChatModel {
    return new FakeChatModel(this.respond, tools.map(toolName));
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const reply = this.respond(messages, this.boundTools);
    const { content = '', toolCall } = typeof reply === 'string' ? { content: reply } : reply;
    // A chunk, because the structured-output parser of @langchain/core only accepts chunks.
    const message = new AIMessageChunk({
      content,
      tool_calls: toolCall ? [{ id: 'fake_call_1', type: 'tool_call', ...toolCall }] : [],
    });
    return { generations: [{ text: content, message }] };
  }
}

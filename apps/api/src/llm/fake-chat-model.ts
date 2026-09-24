import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';

export type FakeResponder = (messages: BaseMessage[]) => string;

/**
 * Deterministic chat model (design §12.3): the same messages always produce the same answer and
 * nothing leaves the process. Tests use it always (REQ-LLM-04).
 */
export class FakeChatModel extends BaseChatModel {
  private readonly respond: FakeResponder;

  constructor(respond: FakeResponder = () => '') {
    super({});
    this.respond = respond;
  }

  _llmType(): string {
    return 'fake';
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const text = this.respond(messages);
    return { generations: [{ text, message: new AIMessage(text) }] };
  }
}

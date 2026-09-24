import { Logger, Module } from '@nestjs/common';
import { selectChatModel, type ChatModelSelection } from './provider.js';

/** Injection token of the selected LangChain chat model. */
export const CHAT_MODEL = Symbol('CHAT_MODEL');
/** Injection token of the selected provider name, reported by `/health`. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
const LLM_SELECTION = Symbol('LLM_SELECTION');

@Module({
  providers: [
    {
      provide: LLM_SELECTION,
      useFactory: () => {
        const selection = selectChatModel(process.env);
        if (selection.warning) new Logger('LLM').warn(selection.warning);
        return selection;
      },
    },
    {
      provide: CHAT_MODEL,
      useFactory: (selection: ChatModelSelection) => selection.model,
      inject: [LLM_SELECTION],
    },
    {
      provide: LLM_PROVIDER,
      useFactory: (selection: ChatModelSelection) => selection.provider,
      inject: [LLM_SELECTION],
    },
  ],
  exports: [CHAT_MODEL, LLM_PROVIDER],
})
export class LlmModule {}

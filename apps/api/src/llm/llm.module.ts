import { Logger, Module } from '@nestjs/common';
import type { SpecBundle } from 'agent-spec';
import { templatesFromBundle } from '../messages/templates.js';
import { SPEC_BUNDLE } from '../spec/spec.module.js';
import { createFakeResponder } from './fake-responder.js';
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
      // With the spec loaded, the fake model answers the text drafts with its message templates.
      useFactory: (bundle?: SpecBundle) => {
        const responder = createFakeResponder(bundle ? templatesFromBundle(bundle) : undefined);
        const selection = selectChatModel(process.env, responder);
        if (selection.warning) new Logger('LLM').warn(selection.warning);
        return selection;
      },
      inject: [{ token: SPEC_BUNDLE, optional: true }],
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

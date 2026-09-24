import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { Test } from '@nestjs/testing';
import { loadSpec } from 'agent-spec';
import { AppModule } from '../src/app.module.js';
import type { AuditLog } from '../src/audit/audit-log.js';
import { AUDIT_LOG } from '../src/audit/audit.module.js';
import { FakeChatModel } from '../src/llm/fake-chat-model.js';
import { createFakeResponder } from '../src/llm/fake-responder.js';
import { CHAT_MODEL } from '../src/llm/llm.module.js';
import { templatesFromBundle } from '../src/messages/templates.js';
import { PROMPT_RUNNER } from '../src/prompts/prompts.module.js';
import type { PromptRunner } from '../src/prompts/prompt-runner.js';
import type { TicketStore } from '../src/tickets/ticket-store.js';
import { TICKET_STORE } from '../src/tickets/tickets.module.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

/** The fake model of the runtime, keeping the messages of every call by the names of its tools. */
export async function recordingModel() {
  const calls: Array<{ tools: string[]; messages: BaseMessage[] }> = [];
  const respond = createFakeResponder(templatesFromBundle(await loadSpec(REPO_ROOT)));
  const model = new FakeChatModel((messages, tools) => {
    calls.push({ tools, messages });
    return respond(messages, tools);
  });
  /** The human message of the first call that bound `tool`. */
  const humanOf = (tool: string) =>
    String(calls.find(({ tools }) => tools.includes(tool))?.messages.at(-1)?.content ?? '');
  return { model, calls, humanOf };
}

/** The api over a temporary data folder, with `model` as chat model and extra variables. */
export async function promptApp(model?: BaseChatModel, env: Record<string, string> = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'helpdesk-prompts-'));
  Object.assign(process.env, { VPN_ALLOWED_TARGETS: '', ...env, DATA_DIR: dataDir });
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (model) builder.overrideProvider(CHAT_MODEL).useValue(model);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return {
    app,
    dataDir,
    runner: app.get<PromptRunner>(PROMPT_RUNNER),
    audit: app.get<AuditLog>(AUDIT_LOG),
    store: app.get<TicketStore>(TICKET_STORE),
  };
}

/** POSTs `variables` to `/prompts/<name>/run` on a listening app. */
export async function postRun(
  app: Awaited<ReturnType<typeof promptApp>>['app'],
  name: string,
  variables: Record<string, string> | undefined,
) {
  const response = await fetch(`${await app.getUrl()}/prompts/${name}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(variables === undefined ? {} : { variables }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

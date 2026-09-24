import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../http/parse-body.js';
import type { PromptRunner } from './prompt-runner.js';
import { startRun } from './start-run.js';
import { PROMPT_RUNNER } from './tokens.js';

/** Body of a prompt run: the variable values, all text (design §7, step 2). */
const RunBody = z.object({ variables: z.record(z.string(), z.string()).optional() });

@Controller('prompts')
export class PromptsController {
  constructor(@Inject(PROMPT_RUNNER) private readonly runner: PromptRunner) {}

  /** Starts the graph at the agent of the prompt; progress arrives through the audit log (SSE). */
  @Post(':name/run')
  @HttpCode(202)
  async run(@Param('name') name: string, @Body() body: unknown): Promise<{ ticketId: string }> {
    const { variables = {} } = parseBody(RunBody, body);
    return { ticketId: await startRun(this.runner, name, variables) };
  }
}

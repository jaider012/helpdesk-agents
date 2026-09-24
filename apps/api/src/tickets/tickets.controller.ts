import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import type { PromptRunner } from '../prompts/prompt-runner.js';
import { startRun } from '../prompts/start-run.js';
import { PROMPT_RUNNER } from '../prompts/tokens.js';

interface CreateTicketBody {
  text?: string;
  channel?: string;
}

@Controller('tickets')
export class TicketsController {
  constructor(@Inject(PROMPT_RUNNER) private readonly runner: PromptRunner) {}

  /** Alias of `POST /prompts/triage-ticket/run` (REQ-API-02, REQ-API-03). */
  @Post()
  @HttpCode(202)
  async create(@Body() body: CreateTicketBody): Promise<{ ticketId: string }> {
    const variables = { ticket: body?.text ?? '', channel: body?.channel ?? '' };
    const field = (variable: string) => (variable === 'ticket' ? 'text' : variable);
    return { ticketId: await startRun(this.runner, 'triage-ticket', variables, field) };
  }
}

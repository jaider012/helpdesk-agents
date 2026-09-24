import { Body, Controller, HttpCode, Inject, Logger, Param, Post } from '@nestjs/common';
import type { PromptRunner } from './prompt-runner.js';
import { PROMPT_RUNNER } from './tokens.js';

interface RunBody {
  variables?: Record<string, string>;
}

@Controller('prompts')
export class PromptsController {
  private readonly logger = new Logger('PromptRun');

  constructor(@Inject(PROMPT_RUNNER) private readonly runner: PromptRunner) {}

  /** Starts the graph at the agent of the prompt; progress arrives through the audit log (SSE). */
  @Post(':name/run')
  @HttpCode(202)
  async run(@Param('name') name: string, @Body() body: RunBody): Promise<{ ticketId: string }> {
    const { ticketId, done } = await this.runner.start(name, body?.variables ?? {});
    // Only the error name is logged: the ticket text never reaches the logs (REQ-SEC-08).
    done.catch((error: unknown) =>
      this.logger.error(
        `run ${ticketId} stopped: ${error instanceof Error ? error.name : 'error'}`,
      ),
    );
    return { ticketId };
  }
}

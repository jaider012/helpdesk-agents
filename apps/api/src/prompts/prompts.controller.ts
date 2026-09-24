import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import {
  InvalidTargetError,
  MissingVariablesError,
  PromptNotFoundError,
  TicketNotFoundError,
  type PromptRunner,
  type StartedRun,
} from './prompt-runner.js';
import { PROMPT_RUNNER } from './tokens.js';

/** Body of a prompt run: the variable values, all text (design §7, step 2). */
const RunBody = z.object({ variables: z.record(z.string(), z.string()).optional() });

@Controller('prompts')
export class PromptsController {
  private readonly logger = new Logger('PromptRun');

  constructor(@Inject(PROMPT_RUNNER) private readonly runner: PromptRunner) {}

  /** Starts the graph at the agent of the prompt; progress arrives through the audit log (SSE). */
  @Post(':name/run')
  @HttpCode(202)
  async run(@Param('name') name: string, @Body() body: unknown): Promise<{ ticketId: string }> {
    const parsed = RunBody.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({ message: 'variables must be an object of text values' });
    }
    const { ticketId, done } = await this.start(name, parsed.data.variables ?? {});
    // Only the error name is logged: the ticket text never reaches the logs (REQ-SEC-08).
    done.catch((error: unknown) =>
      this.logger.error(
        `run ${ticketId} stopped: ${error instanceof Error ? error.name : 'error'}`,
      ),
    );
    return { ticketId };
  }

  /**
   * Starts the run, with 404 for an unknown prompt or ticket and 400 for missing variables or a
   * target that is malformed or not allowed.
   */
  private async start(name: string, variables: Record<string, string>): Promise<StartedRun> {
    try {
      return await this.runner.start(name, variables);
    } catch (error) {
      if (error instanceof PromptNotFoundError || error instanceof TicketNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidTargetError) throw new BadRequestException(error.message);
      if (error instanceof MissingVariablesError) {
        throw new BadRequestException({ message: error.message, missing: error.missing });
      }
      throw error;
    }
  }
}

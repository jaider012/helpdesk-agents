import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import {
  InvalidTargetError,
  MissingVariablesError,
  PromptNotFoundError,
  TicketNotFoundError,
  type PromptRunner,
} from './prompt-runner.js';

const logger = new Logger('PromptRun');

/** Logs a run that stops, with only the error name: the ticket text never reaches the logs (REQ-SEC-08). */
export function logRunFailure(ticketId: string, done: Promise<unknown>): void {
  done.catch((error: unknown) =>
    logger.error(`run ${ticketId} stopped: ${error instanceof Error ? error.name : 'error'}`),
  );
}

/**
 * Starts a prompt run for an HTTP request and returns its ticketId without waiting for the graph:
 * 404 for an unknown prompt or ticket, 400 for missing variables (named through `fieldOf`) or a
 * target that is malformed or not allowed.
 */
export async function startRun(
  runner: PromptRunner,
  name: string,
  variables: Record<string, string>,
  fieldOf: (variable: string) => string = (variable) => variable,
): Promise<string> {
  try {
    const { ticketId, done } = await runner.start(name, variables);
    logRunFailure(ticketId, done);
    return ticketId;
  } catch (error) {
    if (error instanceof PromptNotFoundError || error instanceof TicketNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof InvalidTargetError) throw new BadRequestException(error.message);
    if (error instanceof MissingVariablesError) {
      const missing = error.missing.map(fieldOf);
      throw new BadRequestException({ message: `missing: ${missing.join(', ')}`, missing });
    }
    throw error;
  }
}

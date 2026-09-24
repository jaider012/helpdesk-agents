import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import type { AuditEntry } from '../audit/audit-entry.js';
import type { AuditLog } from '../audit/audit-log.js';
import { AUDIT_LOG } from '../audit/audit.module.js';
import type { PromptRunner } from '../prompts/prompt-runner.js';
import { startRun } from '../prompts/start-run.js';
import { PROMPT_RUNNER } from '../prompts/tokens.js';
import { z } from 'zod';
import { TransitionError, type TicketStateMachine } from './state-machine.js';
import { TICKET_ID_PATTERN } from './ticket-id.js';
import { TicketLifecycle } from './ticket-lifecycle.js';
import type { TicketState } from './ticket-state.js';
import type { TicketStore } from './ticket-store.js';
import { STATE_MACHINE, TICKET_STORE } from './tickets.module.js';

interface CreateTicketBody {
  text?: string;
  channel?: string;
}

/** Body of `POST /tickets/:id/close` (design §12.1). */
const CloseBody = z.object({
  closeReason: z.enum(['user_confirmed', 'no_user_reply', 'handled_by_team']),
});

/** One row of the ticket inbox (REQ-API-04). */
export type TicketSummary = Pick<
  TicketState,
  'ticketId' | 'category' | 'severity' | 'status' | 'slaDueAt' | 'createdAt'
>;

@Controller('tickets')
export class TicketsController {
  private readonly lifecycle: TicketLifecycle;

  constructor(
    @Inject(PROMPT_RUNNER) private readonly runner: PromptRunner,
    @Inject(TICKET_STORE) private readonly store: TicketStore,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(STATE_MACHINE) machine: TicketStateMachine,
  ) {
    this.lifecycle = new TicketLifecycle(machine, audit, store);
  }

  /** Alias of `POST /prompts/triage-ticket/run` (REQ-API-02, REQ-API-03). */
  @Post()
  @HttpCode(202)
  async create(@Body() body: CreateTicketBody): Promise<{ ticketId: string }> {
    const variables = { ticket: body?.text ?? '', channel: body?.channel ?? '' };
    const field = (variable: string) => (variable === 'ticket' ? 'text' : variable);
    return { ticketId: await startRun(this.runner, 'triage-ticket', variables, field) };
  }

  /** The inbox, newest first (REQ-API-04). */
  @Get()
  async list(): Promise<TicketSummary[]> {
    return (await this.store.list()).map(
      ({ ticketId, category, severity, status, slaDueAt, createdAt }) => ({
        ticketId,
        category,
        severity,
        status,
        slaDueAt,
        createdAt,
      }),
    );
  }

  /** The TicketState, without the audit, which has its own endpoint (REQ-API-05). */
  @Get(':id')
  async detail(@Param('id') id: string): Promise<Omit<TicketState, 'audit'>> {
    const ticket: Partial<TicketState> = { ...(await this.find(id)) };
    delete ticket.audit;
    return ticket as Omit<TicketState, 'audit'>;
  }

  /** The audit entries in write order (REQ-API-06). */
  @Get(':id/audit')
  async auditOf(@Param('id') id: string): Promise<AuditEntry[]> {
    const { ticketId } = await this.find(id);
    return this.audit.read(ticketId);
  }

  /**
   * Closes the ticket with its `closeReason` through the state machine (REQ-API-09): 409 with the
   * code when its status has no transition to CLOSED.
   */
  @Post(':id/close')
  @HttpCode(200)
  async close(@Param('id') id: string, @Body() body: unknown): Promise<Omit<TicketState, 'audit'>> {
    const parsed = CloseBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'closeReason must be user_confirmed, no_user_reply or handled_by_team',
      });
    }
    const ticket = await this.find(id);
    const { closeReason } = parsed.data;
    try {
      const closed: Partial<TicketState> = await this.lifecycle.applyTransition(
        { ...ticket, closeReason },
        'CLOSED',
        { agent: 'operator', reason: `closed by the operator: ${closeReason}` },
      );
      delete closed.audit;
      return closed as Omit<TicketState, 'audit'>;
    } catch (error) {
      if (error instanceof TransitionError) {
        throw new ConflictException({ message: error.message, code: error.code });
      }
      throw error;
    }
  }

  /** The stored ticket; 404 for an unknown or malformed id, which never reaches a file path. */
  private async find(id: string): Promise<TicketState> {
    const ticket = TICKET_ID_PATTERN.test(id) ? await this.store.read(id) : undefined;
    if (!ticket) throw new NotFoundException('no ticket with that ticketId');
    return ticket;
  }
}

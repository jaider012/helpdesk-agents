import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import type { AuditEntry } from '../audit/audit-entry.js';
import type { AuditFeed } from '../audit/audit-feed.js';
import type { AuditLog } from '../audit/audit-log.js';
import { AUDIT_FEED, AUDIT_LOG } from '../audit/audit.module.js';
import { parseBody } from '../http/parse-body.js';
import type { PromptRunner } from '../prompts/prompt-runner.js';
import { logRunFailure, startRun } from '../prompts/start-run.js';
import { PROMPT_RUNNER } from '../prompts/tokens.js';
import { TransitionError, type TicketStateMachine } from './state-machine.js';
import { ticketEvents } from './ticket-events.js';
import { TICKET_ID_PATTERN } from './ticket-id.js';
import { TicketLifecycle } from './ticket-lifecycle.js';
import { ISSUE_TYPES, type Entities, type TicketState } from './ticket-state.js';
import type { TicketStore } from './ticket-store.js';
import { STATE_MACHINE, TICKET_STORE } from './tickets.module.js';

/** Body of `POST /tickets` (design §12.1). */
const CreateBody = z.object({
  text: z.string().trim().min(1),
  channel: z.enum(['email', 'chat', 'portal', 'phone']),
});

/** Body of `POST /tickets/:id/close` (design §12.1). */
const CloseBody = z.object({
  closeReason: z.enum(['user_confirmed', 'no_user_reply', 'handled_by_team']),
});

/** Body of `POST /tickets/:id/reply`: the issue type the user chose (design §12.1). */
const ReplyBody = z.object({
  issueType: z.enum(ISSUE_TYPES.filter((issueType) => issueType !== 'unknown')),
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
    @Inject(AUDIT_FEED) private readonly feed: AuditFeed,
    @Inject(STATE_MACHINE) machine: TicketStateMachine,
  ) {
    this.lifecycle = new TicketLifecycle(machine, audit, store);
  }

  /** Alias of `POST /prompts/triage-ticket/run` (REQ-API-02, REQ-API-03). */
  @Post()
  @HttpCode(202)
  async create(@Body() body: unknown): Promise<{ ticketId: string }> {
    const { text, channel } = parseBody(CreateBody, body);
    return { ticketId: await startRun(this.runner, 'triage-ticket', { ticket: text, channel }) };
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
   * The audit entries as Server-Sent Events, then `done` with the status when the run ends
   * (REQ-API-07). A new ticket streams while its graph runs, even before the redact node stores it.
   */
  @Sse(':id/events')
  async events(@Param('id') id: string): Promise<Observable<MessageEvent>> {
    const run = TICKET_ID_PATTERN.test(id) ? this.runner.runOf(id) : undefined;
    if (!run) await this.find(id);
    return ticketEvents(id, {
      audit: this.audit,
      feed: this.feed,
      run,
      // A run that stopped before the redact node stored the ticket leaves it as it started.
      status: async () => (await this.store.read(id))?.status ?? 'NEW',
    });
  }

  /**
   * Closes the ticket with its `closeReason` through the state machine (REQ-API-09): 409 with the
   * code when its status has no transition to CLOSED.
   */
  @Post(':id/close')
  @HttpCode(200)
  async close(@Param('id') id: string, @Body() body: unknown): Promise<Omit<TicketState, 'audit'>> {
    const { closeReason } = parseBody(CloseBody, body);
    const ticket = await this.find(id);
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

  /**
   * The user's answer to WAITING_USER (REQ-API-08): the runtime records the issue type with T8
   * (WAITING_USER → IN_PROGRESS) and resumes the graph at diagnostics.
   */
  @Post(':id/reply')
  @HttpCode(202)
  async reply(@Param('id') id: string, @Body() body: unknown): Promise<{ ticketId: string }> {
    const { issueType } = parseBody(ReplyBody, body);
    const ticket = await this.find(id);
    if (ticket.status !== 'WAITING_USER') {
      throw new ConflictException({
        message: 'only a ticket in WAITING_USER accepts a reply',
        code: 'INVALID_TRANSITION',
      });
    }
    // A ticket in WAITING_USER went through triage, so it has the rest of its entities.
    const entities = { ...ticket.entities, issueType } as Entities;
    const resumed = await this.lifecycle.applyTransition({ ...ticket, entities }, 'IN_PROGRESS', {
      agent: 'runtime',
      reason: 'the user replied with the issue type',
      data: { issueType },
    });
    const { ticketId, done } = this.runner.resume(resumed, 'diagnostics');
    logRunFailure(ticketId, done);
    return { ticketId };
  }

  /** The stored ticket; 404 for an unknown or malformed id, which never reaches a file path. */
  private async find(id: string): Promise<TicketState> {
    const ticket = TICKET_ID_PATTERN.test(id) ? await this.store.read(id) : undefined;
    if (!ticket) throw new NotFoundException('no ticket with that ticketId');
    return ticket;
  }
}

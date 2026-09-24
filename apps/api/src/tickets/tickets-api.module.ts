import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PromptsModule } from '../prompts/prompts.module.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsModule } from './tickets.module.js';

/** The `/tickets` endpoints (design §12.1). */
@Module({ imports: [PromptsModule, TicketsModule, AuditModule], controllers: [TicketsController] })
export class TicketsApiModule {}

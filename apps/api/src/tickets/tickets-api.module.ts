import { Module } from '@nestjs/common';
import { PromptsModule } from '../prompts/prompts.module.js';
import { TicketsController } from './tickets.controller.js';

/** The `/tickets` endpoints (design §12.1). */
@Module({ imports: [PromptsModule], controllers: [TicketsController] })
export class TicketsApiModule {}

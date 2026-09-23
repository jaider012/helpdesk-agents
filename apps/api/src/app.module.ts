import { Module } from '@nestjs/common';
import { LlmModule } from './llm/llm.module.js';
import { SpecModule } from './spec/spec.module.js';
import { TicketsModule } from './tickets/tickets.module.js';

@Module({ imports: [SpecModule.forRoot(), LlmModule, TicketsModule] })
export class AppModule {}

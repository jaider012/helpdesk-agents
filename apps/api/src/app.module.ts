import { Module } from '@nestjs/common';
import { GraphModule } from './graph/graph.module.js';
import { LlmModule } from './llm/llm.module.js';
import { SpecModule } from './spec/spec.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { ToolsModule } from './tools/tools.module.js';

@Module({ imports: [SpecModule.forRoot(), LlmModule, TicketsModule, ToolsModule, GraphModule] })
export class AppModule {}

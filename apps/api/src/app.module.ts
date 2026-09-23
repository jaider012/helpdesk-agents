import { Module } from '@nestjs/common';
import { LlmModule } from './llm/llm.module.js';

@Module({ imports: [LlmModule] })
export class AppModule {}

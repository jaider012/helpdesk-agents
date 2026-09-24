import { Module } from '@nestjs/common';
import { LlmModule } from './llm/llm.module.js';
import { SpecModule } from './spec/spec.module.js';

@Module({ imports: [SpecModule.forRoot(), LlmModule] })
export class AppModule {}

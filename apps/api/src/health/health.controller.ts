import { Controller, Get, Inject } from '@nestjs/common';
import { formatError, loadSpec, validateSpec } from 'agent-spec';
import { LLM_PROVIDER } from '../llm/llm.module.js';
import type { LlmProvider } from '../llm/provider.js';
import { SPEC_ROOT } from '../spec/spec.module.js';

export interface SpecStatus {
  valid: boolean;
  errors: string[];
}

/**
 * Validates `.github/` as it is on disk now, so the operator sees the effect of an edit before
 * restarting; the running graph keeps the spec it was compiled from at startup.
 */
export async function specStatus(root: string): Promise<SpecStatus> {
  try {
    const errors = validateSpec(await loadSpec(root)).map(formatError);
    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    @Inject(SPEC_ROOT) private readonly specRoot: string,
  ) {}

  /** The active LLM provider and the spec validation status (REQ-API-10). */
  @Get()
  async health(): Promise<{ llmProvider: LlmProvider; spec: SpecStatus }> {
    return { llmProvider: this.llmProvider, spec: await specStatus(this.specRoot) };
  }
}

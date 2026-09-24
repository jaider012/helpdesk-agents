import { fileURLToPath } from 'node:url';
import { Module, type DynamicModule } from '@nestjs/common';
import {
  formatError,
  loadSpec,
  validateSpec,
  type SpecBundle,
  type ValidationError,
} from 'agent-spec';

/** Injection token of the validated `.github/` spec bundle. */
export const SPEC_BUNDLE = Symbol('SPEC_BUNDLE');

/** Repository root, the folder that contains `.github/` (same depth from `src/` and `dist/`). */
export const DEFAULT_SPEC_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

export class SpecValidationError extends Error {
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const count = `${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`;
    super(`spec validation failed with ${count}:\n${errors.map(formatError).join('\n')}`);
    this.name = 'SpecValidationError';
    this.errors = errors;
  }
}

/** Loads `<root>/.github/` and throws a SpecValidationError when it breaks any rule (REQ-API-01). */
export async function loadValidatedSpec(root: string): Promise<SpecBundle> {
  const bundle = await loadSpec(root);
  const errors = validateSpec(bundle);
  if (errors.length > 0) throw new SpecValidationError(errors);
  return bundle;
}

@Module({})
export class SpecModule {
  static forRoot(options: { root?: string } = {}): DynamicModule {
    return {
      module: SpecModule,
      global: true,
      providers: [
        {
          provide: SPEC_BUNDLE,
          useFactory: () => loadValidatedSpec(options.root ?? DEFAULT_SPEC_ROOT),
        },
      ],
      exports: [SPEC_BUNDLE],
    };
  }
}

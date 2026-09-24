import { Module, type DynamicModule } from '@nestjs/common';
import {
  formatError,
  loadSpec,
  validateSpec,
  type SpecBundle,
  type ValidationError,
} from 'agent-spec';
import { REPO_ROOT } from '../paths.js';

/** Injection token of the validated `.github/` spec bundle. */
export const SPEC_BUNDLE = Symbol('SPEC_BUNDLE');

/** Injection token of the folder that contains the `.github/` spec. */
export const SPEC_ROOT = Symbol('SPEC_ROOT');

/** Folder that contains `.github/`: the repository root. */
export const DEFAULT_SPEC_ROOT = REPO_ROOT;

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
        { provide: SPEC_ROOT, useValue: options.root ?? DEFAULT_SPEC_ROOT },
        {
          provide: SPEC_BUNDLE,
          useFactory: (root: string) => loadValidatedSpec(root),
          inject: [SPEC_ROOT],
        },
      ],
      exports: [SPEC_BUNDLE, SPEC_ROOT],
    };
  }
}

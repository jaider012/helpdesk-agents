import { Module } from '@nestjs/common';
import type { SpecBundle } from 'agent-spec';
import { AUDIT_LOG, AuditModule } from '../audit/audit.module.js';
import type { AuditLog } from '../audit/audit-log.js';
import { SPEC_BUNDLE } from '../spec/spec.module.js';
import { ActionService } from './actions.js';

/** Injection token of the remediation action service. */
export const ACTION_SERVICE = Symbol('ACTION_SERVICE');

@Module({
  imports: [AuditModule],
  providers: [
    {
      provide: ACTION_SERVICE,
      useFactory: (bundle: SpecBundle, audit: AuditLog) => ActionService.fromBundle(bundle, audit),
      inject: [SPEC_BUNDLE, AUDIT_LOG],
    },
  ],
  exports: [ACTION_SERVICE],
})
export class ToolsModule {}

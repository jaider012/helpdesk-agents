import { Module } from '@nestjs/common';
import { resolveDataDir } from '../paths.js';
import { AuditLog } from './audit-log.js';

/** Injection token of the JSONL audit log. */
export const AUDIT_LOG = Symbol('AUDIT_LOG');

@Module({
  providers: [{ provide: AUDIT_LOG, useFactory: () => new AuditLog(resolveDataDir(process.env)) }],
  exports: [AUDIT_LOG],
})
export class AuditModule {}

import { Module } from '@nestjs/common';
import { resolveDataDir } from '../paths.js';
import { AuditFeed } from './audit-feed.js';
import { AuditLog } from './audit-log.js';

/** Injection token of the JSONL audit log. */
export const AUDIT_LOG = Symbol('AUDIT_LOG');

/** Injection token of the feed of written audit entries (SSE). */
export const AUDIT_FEED = Symbol('AUDIT_FEED');

@Module({
  providers: [
    { provide: AUDIT_FEED, useFactory: () => new AuditFeed() },
    {
      provide: AUDIT_LOG,
      useFactory: (feed: AuditFeed) =>
        new AuditLog(resolveDataDir(process.env), () => new Date(), feed),
      inject: [AUDIT_FEED],
    },
  ],
  exports: [AUDIT_LOG, AUDIT_FEED],
})
export class AuditModule {}

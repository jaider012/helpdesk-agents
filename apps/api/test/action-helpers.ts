import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSpec } from 'agent-spec';
import { AuditLog } from '../src/audit/audit-log.js';
import { ActionService } from '../src/tools/actions.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

export async function tempAudit(): Promise<AuditLog> {
  const dataDir = await mkdtemp(join(tmpdir(), 'helpdesk-actions-'));
  return new AuditLog(dataDir, () => new Date('2026-09-23T10:30:00.000Z'));
}

/** The action service over the real remediation allowlist of `diagnostics.agent.md`. */
export async function realActionService(audit: AuditLog): Promise<ActionService> {
  return ActionService.fromBundle(
    await loadSpec(REPO_ROOT),
    audit,
    () => new Date('2026-09-23T10:30:00.000Z'),
  );
}

export async function fixtureActionService(name: string, audit: AuditLog): Promise<ActionService> {
  const body = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  return ActionService.fromAllowlistBody(body, audit);
}

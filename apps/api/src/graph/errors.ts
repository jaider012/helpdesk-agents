/**
 * Write failures of the audit log or the ticket store: the only errors that stop a run
 * (REQ-AUD-06, REQ-AUD-08, design §11).
 */
export function isIoError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code } = error as { code?: unknown };
  return 'errno' in error || code === 'AUDIT_WRITE_FAILED' || code === 'STORE_WRITE_FAILED';
}

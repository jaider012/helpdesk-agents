import { FORBIDDEN_ALLOWLIST_TAGS } from './policy.ts';
import { findTable } from './tables.ts';

export const ALLOWLIST_HEADING = '## Allowlist de remediación';

export interface AllowlistAction {
  id: string;
  kind: string;
  appliesTo: string;
  tags: string[];
  description: string;
}

export interface AllowlistIssue {
  code: 'UNSAFE_ALLOWLIST_ACTION';
  message: string;
}

const COLUMNS = ['id', 'tipo', 'aplica a', 'etiquetas', 'descripción'] as const;

function stripCode(cell: string): string {
  return cell.trim().replace(/^`|`$/g, '').trim();
}

/** Reads the remediation allowlist table of an agent body (design §5.5); `[]` without a table. */
export function compileAllowlist(body: string): AllowlistAction[] {
  const table = findTable(body, ALLOWLIST_HEADING);
  if (!table) return [];
  const [id, kind, appliesTo, tags, description] = COLUMNS.map((name) =>
    table.header.indexOf(name),
  );
  return table.rows.map((row) => ({
    id: stripCode(row[id] ?? ''),
    kind: stripCode(row[kind] ?? ''),
    appliesTo: stripCode(row[appliesTo] ?? ''),
    tags: (row[tags] ?? '').split(',').map(stripCode).filter(Boolean),
    description: (row[description] ?? '').trim(),
  }));
}

/** Allowlist actions tagged `mfa`, `credentials` or `permissions` (REQ-2.3-33). */
export function allowlistIssues(body: string): AllowlistIssue[] {
  const forbidden: readonly string[] = FORBIDDEN_ALLOWLIST_TAGS;
  return compileAllowlist(body).flatMap((action) =>
    action.tags
      .filter((tag) => forbidden.includes(tag))
      .map((tag) => ({
        code: 'UNSAFE_ALLOWLIST_ACTION' as const,
        message: `allowlist action \`${action.id}\` is tagged \`${tag}\``,
      })),
  );
}

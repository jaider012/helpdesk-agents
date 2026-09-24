import { findTable, LIFECYCLE_PATH, type Severity, type SpecBundle } from 'agent-spec';

export const SLA_HEADING = '## SLA';

/** `slaDueAt` for a severity and a creation time (design §3.2). */
export type SlaPolicy = (severity: Severity, createdAt: string) => string;

/**
 * Compiles the `## SLA` table of `ticket-lifecycle.instructions.md` (columns `severidad` and
 * `objetivo de resolución`, in hours): `slaDueAt = createdAt + target` (REQ-2.1-14).
 */
export function compileSla(body: string): SlaPolicy {
  const table = findTable(body, SLA_HEADING);
  if (!table) throw new Error(`no table under the heading \`${SLA_HEADING}\``);
  const [severityColumn, targetColumn] = ['severidad', 'objetivo de resolución'].map((name) =>
    table.header.indexOf(name),
  );
  const hours = new Map(
    table.rows.map((row) => [
      row[severityColumn],
      Number(/^(\d+(?:\.\d+)?)\s*h$/.exec(row[targetColumn])?.[1]),
    ]),
  );
  return (severity, createdAt) => {
    const target = hours.get(severity);
    if (target === undefined || Number.isNaN(target)) {
      throw new Error(`the SLA table has no target for ${severity}`);
    }
    return new Date(Date.parse(createdAt) + target * 3_600_000).toISOString();
  };
}

export function slaFromBundle(bundle: SpecBundle): SlaPolicy {
  const file = bundle.files.find(({ path }) => path === LIFECYCLE_PATH);
  if (!file?.frontmatter.ok) throw new Error(`${LIFECYCLE_PATH} is missing or invalid`);
  return compileSla(file.frontmatter.body);
}

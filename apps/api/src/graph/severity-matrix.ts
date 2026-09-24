import { findTable, SEVERITIES, type Severity } from 'agent-spec';
import type { Level } from '../tickets/ticket-state.js';

export const SEVERITY_HEADING = '## Matriz de severidad';

export type SeverityMatrix = (impact: Level, urgency: Level) => Severity;

/** Compiles the impact × urgency table of `triage.agent.md` (design §5.3, REQ-2.3-19). */
export function compileSeverityMatrix(body: string): SeverityMatrix {
  const table = findTable(body, SEVERITY_HEADING);
  if (!table) throw new Error(`no table under the heading \`${SEVERITY_HEADING}\``);
  const urgencies = table.header.slice(1);
  const cells = new Map<string, Severity>();
  for (const [impact, ...severities] of table.rows) {
    severities.forEach((severity, index) => {
      if (!(SEVERITIES as readonly string[]).includes(severity)) {
        throw new Error(`\`${severity}\` is not a severity`);
      }
      cells.set(`${impact}|${urgencies[index]}`, severity as Severity);
    });
  }
  return (impact, urgency) => {
    const severity = cells.get(`${impact}|${urgency}`);
    if (!severity) throw new Error(`the severity matrix has no cell for ${impact} × ${urgency}`);
    return severity;
  };
}

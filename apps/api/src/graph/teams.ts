import { findTable, type Category } from 'agent-spec';

export const TEAMS_HEADING = '## Equipos de escalamiento';

/** The team that receives an escalated ticket of a category. */
export type TeamDirectory = (category: Category) => string | undefined;

/**
 * Compiles the category-to-team table of `escalation.agent.md` (columns `categoría` and `equipo`,
 * REQ-ESC-07). Without the table, no ticket gets a team.
 */
export function compileTeams(body: string): TeamDirectory {
  const table = findTable(body, TEAMS_HEADING);
  if (!table) return () => undefined;
  const [categoryColumn, teamColumn] = ['categoría', 'equipo'].map((name) =>
    table.header.indexOf(name),
  );
  const teams = new Map(table.rows.map((row) => [row[categoryColumn], row[teamColumn]]));
  return (category) => teams.get(category);
}

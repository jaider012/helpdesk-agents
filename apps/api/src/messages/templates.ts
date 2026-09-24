import { findTable, type SpecBundle } from 'agent-spec';

export const TEMPLATES_HEADING = '## Plantillas de mensaje';
export const COPILOT_INSTRUCTIONS = '.github/copilot-instructions.md';

export interface MessageTemplates {
  keys: string[];
  /** The template text with `{ticketId}` and the other markers replaced. */
  render(key: string, values: Record<string, string>): string;
}

/** Compiles the `clave | texto` table of `copilot-instructions.md` (design §9). */
export function compileTemplates(body: string): MessageTemplates {
  const table = findTable(body, TEMPLATES_HEADING);
  if (!table) throw new Error(`no table under the heading \`${TEMPLATES_HEADING}\``);
  const [keyColumn, textColumn] = ['clave', 'texto'].map((name) => table.header.indexOf(name));
  const templates = new Map(
    table.rows.map((row) => [row[keyColumn].replace(/^`|`$/g, ''), row[textColumn]]),
  );
  return {
    keys: [...templates.keys()],
    render(key, values) {
      const text = templates.get(key);
      if (text === undefined) throw new Error(`unknown message template \`${key}\``);
      return text.replace(/\{(\w+)\}/g, (marker, name: string) => values[name] ?? marker);
    },
  };
}

export function templatesFromBundle(bundle: SpecBundle): MessageTemplates {
  const file = bundle.files.find(({ path }) => path === COPILOT_INSTRUCTIONS);
  if (!file?.frontmatter.ok) throw new Error(`${COPILOT_INSTRUCTIONS} is missing or invalid`);
  return compileTemplates(file.frontmatter.body);
}

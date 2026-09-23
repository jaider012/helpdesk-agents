import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export type FrontmatterKind = 'agent' | 'skill' | 'prompt' | 'instructions';

export type ParsedFrontmatter =
  { ok: true; data: Record<string, unknown>; body: string } | { ok: false; error: string };

/**
 * Splits a Markdown file into its YAML frontmatter and body. YAML 1.2 via `yaml`, which also
 * rejects duplicate keys. A missing or empty frontmatter parses as `{}`.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  let file: matter.GrayMatterFile<string>;
  try {
    file = matter(raw, { engines: { yaml: (source: string) => parseYaml(source) ?? {} } });
  } catch (error) {
    return { ok: false, error: firstLine(error) };
  }
  const data: unknown = file.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'frontmatter must be a YAML mapping' };
  }
  return { ok: true, data: data as Record<string, unknown>, body: file.content };
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0];
}

// Only the key sets of Annex A (requirements.md) live here. The value checks belong to the rules
// of each file type, so every value is accepted as `unknown` at this level.
const any = z.unknown().optional();

const handoff = z.strictObject({ label: any, agent: any, prompt: any, send: any, model: any });

export const FRONTMATTER_SCHEMAS: Record<FrontmatterKind, z.ZodType> = {
  agent: z.strictObject({
    description: any,
    name: any,
    'argument-hint': any,
    tools: any,
    agents: any,
    model: any,
    'user-invocable': any,
    'disable-model-invocation': any,
    target: any,
    'mcp-servers': any,
    handoffs: z.array(handoff).optional(),
    hooks: any,
  }),
  skill: z.strictObject({
    name: any,
    description: any,
    'argument-hint': any,
    'user-invocable': any,
    'disable-model-invocation': any,
    context: any,
  }),
  prompt: z.strictObject({
    description: any,
    name: any,
    'argument-hint': any,
    agent: any,
    model: any,
    tools: any,
  }),
  instructions: z.strictObject({ name: any, description: any, applyTo: any }),
};

/** Returns the keys outside the Annex A set, top-level keys first, as `key` or `handoffs[0].key`. */
export function unknownKeys(kind: FrontmatterKind, data: Record<string, unknown>): string[] {
  const result = FRONTMATTER_SCHEMAS[kind].safeParse(data);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.code === 'unrecognized_keys')
    .sort((a, b) => a.path.length - b.path.length)
    .flatMap((issue) => issue.keys.map((key) => formatPath([...issue.path, key])));
}

function formatPath(path: PropertyKey[]): string {
  return path
    .map((segment, index) =>
      typeof segment === 'number' ? `[${segment}]` : `${index === 0 ? '' : '.'}${String(segment)}`,
    )
    .join('');
}

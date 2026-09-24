// `pnpm spec:graph`: prints the compiled handoff graph as Mermaid; `--write` updates README.md.
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadSpec } from './load.ts';
import { handoffGraphMermaid, replaceReadmeGraph } from './mermaid.ts';

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: process.cwd() },
    write: { type: 'boolean', default: false },
  },
});

const root = resolve(values.root);
const mermaid = handoffGraphMermaid(await loadSpec(root));
if (values.write) {
  const readme = join(root, 'README.md');
  await writeFile(readme, replaceReadmeGraph(await readFile(readme, 'utf8'), mermaid));
} else {
  process.stdout.write(mermaid);
}

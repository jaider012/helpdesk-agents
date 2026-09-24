import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildHandoffGraph,
  handoffGraphMermaid,
  loadSpec,
  replaceReadmeGraph,
} from '../src/index.ts';
import { REPO_ROOT } from './helpers.ts';

const CLI = fileURLToPath(new URL('../src/graph-cli.ts', import.meta.url));
const README_BLOCK =
  /<!-- SPEC:GRAPH:START -->\n```mermaid\n([\s\S]*?)```\n<!-- SPEC:GRAPH:END -->/;

/** Runs `pnpm spec:graph` as the root script does, against the repository spec. */
function specGraph(): string {
  return spawnSync(process.execPath, [CLI, '--root', REPO_ROOT], { encoding: 'utf8' }).stdout;
}

describe('docs.readme-graph', () => {
  it('prints the same Mermaid flowchart that README.md embeds', () => {
    const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
    const embedded = README_BLOCK.exec(readme)?.[1];

    expect(embedded).toBeDefined();
    expect(specGraph()).toBe(embedded);
  });

  it('draws one edge per declared handoff, the entry edges and the ends of the run', async () => {
    const bundle = await loadSpec(REPO_ROOT);
    const mermaid = handoffGraphMermaid(bundle);

    expect(mermaid.startsWith('flowchart TD\n')).toBe(true);
    for (const { from, to, label } of buildHandoffGraph(bundle).edges) {
      expect(mermaid).toContain(`  ${from} -->|"${label} · R-`);
      expect(mermaid).toMatch(new RegExp(`\\| ${to}\\n`));
    }
    expect(mermaid).toContain('  redact -->|"ticket nuevo · /triage-ticket"| triage\n');
    expect(mermaid).toContain('  redact -->|"/run-vpn-diagnostics"| diagnostics\n');
    expect(mermaid).toContain('  redact -->|"/escalate-ticket"| escalation\n');
    expect(mermaid).toContain('  diagnostics -->|"R-D1, R-D2, R-D3"| FIN\n');
    expect(mermaid).toContain('  escalation --> FIN\n');
    expect(mermaid).not.toMatch(/escalation -->\|/);
  });

  it('replaces only the block between the README markers', () => {
    const readme = 'antes\n<!-- SPEC:GRAPH:START -->\nviejo\n<!-- SPEC:GRAPH:END -->\ndespués\n';

    expect(replaceReadmeGraph(readme, 'flowchart TD\n  a --> b\n')).toBe(
      'antes\n<!-- SPEC:GRAPH:START -->\n```mermaid\nflowchart TD\n  a --> b\n```\n<!-- SPEC:GRAPH:END -->\ndespués\n',
    );
    expect(() => replaceReadmeGraph('sin marcadores', 'flowchart TD\n')).toThrow(/SPEC:GRAPH/);
  });
});

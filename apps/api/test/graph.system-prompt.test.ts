import { loadSpec } from 'agent-spec';
import { describe, expect, it } from 'vitest';
import { realGraph } from './graph-helpers.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

describe('graph.system-prompt', () => {
  it('loads the body of each .agent.md file as the system prompt of its node', async () => {
    const bundle = await loadSpec(REPO_ROOT);
    const drawable = await (await realGraph()).getGraphAsync();

    for (const file of bundle.files.filter(({ kind }) => kind === 'agent')) {
      if (!file.frontmatter.ok) throw new Error(`${file.path} is invalid`);
      const name = file.path.split('/').at(-1)?.replace('.agent.md', '') ?? '';

      expect(drawable.nodes[name].metadata?.systemPrompt).toBe(file.frontmatter.body);
      expect(drawable.nodes[name].metadata?.systemPrompt).toContain(`# Agente ${name}`);
    }
  });
});

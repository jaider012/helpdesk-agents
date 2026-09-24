import { describe, expect, it } from 'vitest';
import { newTicket, runtime } from './runtime-helpers.js';

describe('escalation.terminal', () => {
  it('ends the graph execution after the escalation node', async () => {
    const visited: string[] = [];
    const record = (name: string) => () => {
      visited.push(name);
      return {};
    };
    const { graph } = await runtime({
      override: { diagnostics: record('diagnostics'), provisioning: record('provisioning') },
    });

    const final = await graph.invoke(
      newTicket('TCK-20260923-101500-end', 'La impresora del piso 3 no imprime.'),
    );

    expect(final.status).toBe('ESCALATED');
    expect(visited).toEqual([]);
    const edges = (await graph.getGraphAsync()).edges.filter(
      ({ source }) => source === 'escalation',
    );
    expect(edges.map(({ target }) => target)).toEqual(['__end__']);
  });
});

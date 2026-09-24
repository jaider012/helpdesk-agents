import { describe, expect, it } from 'vitest';
import { leakedValues, PII_TICKETS, readTree } from './pii-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

describe('redact.persistence', () => {
  it('leaves zero occurrences of the original values in data/ after each branch of the graph', async () => {
    // Every synthetic value is in the input, so a leak of any of them would show up.
    expect(leakedValues(PII_TICKETS.map(([, text]) => text).join('\n'))).toHaveLength(6);
    const { graph, dataDir } = await runtime();

    for (const [ticketId, rawText] of PII_TICKETS) await graph.invoke(newTicket(ticketId, rawText));

    const files = await readTree(dataDir);
    expect([...files.keys()].filter((path) => path.endsWith('.jsonl'))).toHaveLength(
      PII_TICKETS.length,
    );
    expect([...files.keys()].filter((path) => path.endsWith('.json'))).toHaveLength(
      PII_TICKETS.length,
    );
    for (const [path, content] of files)
      expect({ path, leaked: leakedValues(content) }).toEqual({ path, leaked: [] });
  });
});

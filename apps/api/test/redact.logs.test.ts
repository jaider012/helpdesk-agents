import { afterEach, describe, expect, it, vi } from 'vitest';
import { leakedValues, PII_TICKETS } from './pii-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

describe('redact.logs', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes none of the original values to the application logs', async () => {
    const written: string[] = [];
    const capture = (...chunks: unknown[]) => void written.push(chunks.map(String).join(' '));
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation(capture);
    }
    const stdout = process.stdout.write.bind(process.stdout);
    const stderr = process.stderr.write.bind(process.stderr);
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk, ...rest) => {
      written.push(String(chunk));
      return stdout(chunk, ...(rest as []));
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk, ...rest) => {
      written.push(String(chunk));
      return stderr(chunk, ...(rest as []));
    });
    const { graph } = await runtime();

    for (const [ticketId, rawText] of PII_TICKETS) await graph.invoke(newTicket(ticketId, rawText));

    expect(leakedValues(written.join('\n'))).toEqual([]);
  });
});

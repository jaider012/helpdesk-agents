import { describe, expect, it } from 'vitest';
import { resolveLlmTimeoutMs } from '../src/llm/provider.js';
import { fakeWithClassify } from './llm-failure-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

describe('llm.failure', () => {
  it('routes the ticket to escalation with llm_unavailable when the triage LLM call fails', async () => {
    const model = await fakeWithClassify(() => {
      throw new Error('503 Service Unavailable');
    });
    const { graph, audit } = await runtime({ model });
    const ticketId = 'TCK-20260923-101500-lf1';

    const final = await graph.invoke(newTicket(ticketId, 'La VPN no conecta.'));

    expect(final.status).toBe('ESCALATED');
    expect(final.escalationPackage?.reason).toBe('llm_unavailable');
    expect(
      (await audit.read(ticketId)).map(({ decision, from, to, data }) => [
        decision,
        from,
        to,
        data?.rule ?? data?.cause,
      ]),
    ).toEqual([
      ['redacted', undefined, undefined, undefined],
      ['llm_unavailable', undefined, undefined, 'error'],
      ['routed', 'triage', 'escalation', 'R-X1'],
      ['escalated', undefined, undefined, undefined],
      ['transition', 'NEW', 'ESCALATED', undefined],
    ]);
  });

  it('routes the ticket to escalation with llm_unavailable when the triage LLM call exceeds the timeout', async () => {
    const model = await fakeWithClassify(() => new Promise<never>(() => undefined));
    const { graph, audit } = await runtime({ model, llmTimeoutMs: 30 });
    const ticketId = 'TCK-20260923-101500-lf2';

    const final = await graph.invoke(newTicket(ticketId, 'La VPN no conecta.'));

    expect(final.escalationPackage?.reason).toBe('llm_unavailable');
    expect(
      (await audit.read(ticketId)).find(({ decision }) => decision === 'llm_unavailable')?.data,
    ).toEqual({
      cause: 'timeout',
      timeoutMs: 30,
    });
  });

  it('uses LLM_TIMEOUT_MS as the timeout, 30 s by default', () => {
    expect(resolveLlmTimeoutMs({})).toBe(30_000);
    expect(resolveLlmTimeoutMs({ LLM_TIMEOUT_MS: '5000' })).toBe(5000);
    expect(resolveLlmTimeoutMs({ LLM_TIMEOUT_MS: 'soon' })).toBe(30_000);
  });
});

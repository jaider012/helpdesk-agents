import { describe, expect, it } from 'vitest';
import { CLASSIFY_TOOL } from '../src/llm/fake-responder.js';
import { fakeWithClassify } from './llm-failure-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

describe('llm.invalid-output', () => {
  it.each([
    [
      'a category outside the enum',
      { category: 'hardware', issueType: 'vpn', businessImpact: 'medium', urgency: 'medium' },
    ],
    ['a missing urgency', { category: 'infra', issueType: 'vpn', businessImpact: 'medium' }],
  ])('routes the ticket to escalation with invalid_llm_output for %s', async (_, args) => {
    const model = await fakeWithClassify(() => ({ toolCall: { name: CLASSIFY_TOOL, args } }));
    const { graph, audit } = await runtime({ model });
    const ticketId = 'TCK-20260923-101500-inv';

    const final = await graph.invoke(newTicket(ticketId, 'La VPN no conecta.'));

    expect(final.status).toBe('ESCALATED');
    expect(final.escalationPackage?.reason).toBe('invalid_llm_output');
    expect(final.lastRoute).toEqual({
      from: 'triage',
      to: 'escalation',
      rule: 'R-X2',
      reason: 'invalid_llm_output',
    });
    expect((await audit.read(ticketId)).map(({ decision }) => decision)).toContain(
      'invalid_llm_output',
    );
  });
});

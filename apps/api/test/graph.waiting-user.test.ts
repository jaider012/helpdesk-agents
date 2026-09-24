import { describe, expect, it } from 'vitest';
import { CLASSIFY_TOOL } from '../src/llm/fake-responder.js';
import { fakeWithClassify } from './llm-failure-helpers.js';
import { newTicket, runtime } from './runtime-helpers.js';

describe('graph.waiting-user', () => {
  it.each(['infra', 'access'])(
    'asks the user for the missing detail when a %s ticket has issueType unknown',
    async (category) => {
      const args = { category, issueType: 'unknown', businessImpact: 'medium', urgency: 'medium' };
      const model = await fakeWithClassify(() => ({ toolCall: { name: CLASSIFY_TOOL, args } }));
      const { graph, audit } = await runtime({ model });
      const ticketId = 'TCK-20260923-101500-wus';

      const final = await graph.invoke(newTicket(ticketId, 'Algo no funciona en mi equipo.'));

      expect(final.status).toBe('WAITING_USER');
      expect(final.userMessage).toBe(
        `Para ayudarte con el caso ${ticketId} necesitamos un dato más: ¿qué falla? Elige una opción: conexión remota (VPN), lentitud del equipo o una aplicación.`,
      );
      expect(final.lastRoute).toEqual({ from: 'diagnostics', to: 'END', rule: 'R-D3' });
      const transitions = (await audit.read(ticketId))
        .filter(({ decision }) => decision === 'transition')
        .map(({ from, to }) => `${from}→${to}`);
      expect(transitions).toEqual([
        'NEW→TRIAGED',
        'TRIAGED→IN_PROGRESS',
        'IN_PROGRESS→WAITING_USER',
      ]);
    },
  );
});

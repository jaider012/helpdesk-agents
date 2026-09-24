import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

const ALLOWED = '(`ticketId`, `category`, `severity`, `entities`, `findings`)';

describe('agents.handoff-context', () => {
  it('reports HANDOFF_CONTEXT_EXCEEDED for a TicketState field outside the allowed context', async () => {
    expect(await errorsWithCode('agents-handoff-context', 'HANDOFF_CONTEXT_EXCEEDED')).toEqual([
      {
        code: 'HANDOFF_CONTEXT_EXCEEDED',
        path: '.github/agents/triage.agent.md',
        message: `handoff \`Diagnosticar\` names \`redactedText\`, outside the allowed context ${ALLOWED}`,
      },
      {
        code: 'HANDOFF_CONTEXT_EXCEEDED',
        path: '.github/agents/triage.agent.md',
        message: `handoff \`Escalar\` names \`userMessage\`, outside the allowed context ${ALLOWED}`,
      },
    ]);
  });

  it.each(['agents-valid', REPO_ROOT])(
    'accepts prompts limited to the allowed context (%s)',
    async (root) => {
      expect(await errorsWithCode(root, 'HANDOFF_CONTEXT_EXCEEDED')).toEqual([]);
    },
  );
});

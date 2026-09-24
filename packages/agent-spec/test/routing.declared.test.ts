import { describe, expect, it } from 'vitest';
import { errorsWithCode, REPO_ROOT } from './helpers.ts';

describe('routing.declared', () => {
  it('reports ROUTE_WITHOUT_HANDOFF for a rule whose target is not a declared handoff', async () => {
    expect(await errorsWithCode('routing-missing-handoff', 'ROUTE_WITHOUT_HANDOFF')).toEqual([
      {
        code: 'ROUTE_WITHOUT_HANDOFF',
        path: '.github/agents/triage.agent.md',
        message: 'rule `R-T3` routes `triage` → `provisioning`, which is not a declared handoff',
      },
    ]);
  });

  it('accepts routing rules whose targets are all declared handoffs', async () => {
    expect(await errorsWithCode(REPO_ROOT, 'ROUTE_WITHOUT_HANDOFF')).toEqual([]);
  });
});

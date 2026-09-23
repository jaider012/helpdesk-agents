import { describe, expect, it } from 'vitest';
import { loadSpec, validateSpec, type ValidationError } from '../src/index.ts';
import { REPO_ROOT } from './cli.ts';
import { fixture } from './helpers.ts';

const ANNEX_D = [
  '.github/agents/diagnostics.agent.md',
  '.github/agents/escalation.agent.md',
  '.github/agents/provisioning.agent.md',
  '.github/agents/triage.agent.md',
  '.github/copilot-instructions.md',
  '.github/instructions/ticket-lifecycle.instructions.md',
  '.github/prompts/escalate-ticket.prompt.md',
  '.github/prompts/run-vpn-diagnostics.prompt.md',
  '.github/prompts/triage-ticket.prompt.md',
  '.github/skills/vpn-diagnostics/SKILL.md',
  '.github/skills/vpn-diagnostics/scripts/check-vpn.js',
];

async function missingFiles(root: string): Promise<string[]> {
  const errors = validateSpec(await loadSpec(root));
  return errors
    .filter((e: ValidationError) => e.code === 'REQUIRED_FILE_MISSING')
    .map((e) => e.path);
}

describe('validate.required-files', () => {
  it('reports REQUIRED_FILE_MISSING with the path of each Annex D file that is absent', async () => {
    expect(await missingFiles(fixture('required-missing'))).toEqual(
      ANNEX_D.filter(
        (path) =>
          path !== '.github/agents/triage.agent.md' && path !== '.github/copilot-instructions.md',
      ),
    );
  });

  it('reports every Annex D file when there is no .github folder', async () => {
    expect(await missingFiles(fixture('no-github'))).toEqual(ANNEX_D);
  });

  it('reports nothing for the real .github folder', async () => {
    expect(await missingFiles(REPO_ROOT)).toEqual([]);
  });
});

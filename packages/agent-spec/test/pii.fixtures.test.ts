import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emailIssues, piiIssues } from '../src/pii.ts';
import { REPO_ROOT, runCli } from './cli.ts';

// Assembled at runtime so this test file never contains a non-example address itself.
const OUTSIDE = ['persona.real', 'correo-real.test'].join('@');

/** A copy of the repository spec in a temporary root, plus extra files. */
function specRoot(extra: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'agent-spec-pii-'));
  cpSync(join(REPO_ROOT, '.github'), join(root, '.github'), { recursive: true });
  for (const [path, content] of Object.entries(extra)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('pii.fixtures', () => {
  it('accepts addresses of example.com, example.internal and their subdomains', () => {
    const text = 'ana.demo@example.com, jefe.demo+vpn@example.internal, x@mail.example.com';

    expect(emailIssues('docs.md', text)).toEqual([]);
  });

  it('reports PII_IN_FIXTURE with the line, without repeating the address', () => {
    const issues = emailIssues(
      '.github/agents/triage.agent.md',
      `línea uno\ncontacto: ${OUTSIDE}\n`,
    );

    expect(issues).toEqual([
      {
        code: 'PII_IN_FIXTURE',
        path: '.github/agents/triage.agent.md',
        message: 'line 2 has an email address outside example.com and example.internal',
      },
    ]);
    expect(issues[0]?.message).not.toContain(OUTSIDE);
  });

  it('scans .github/ and the test fixtures, and skips node_modules', async () => {
    const root = specRoot({
      '.github/prompts/extra.md': `Escríbele a ${OUTSIDE}`,
      'apps/demo/test/fixtures/ticket.json': `{"from":"${OUTSIDE}"}`,
      'tests/check/fixtures/ok.json': '{"from":"ana.demo@example.com"}',
      'node_modules/pkg/test/fixtures/x.json': `{"from":"${OUTSIDE}"}`,
    });

    const paths = (await piiIssues(root)).map(({ path }) => path).sort();

    expect(paths).toEqual(['.github/prompts/extra.md', 'apps/demo/test/fixtures/ticket.json']);
  });

  it('makes pnpm spec:validate fail on an address outside the example domains', () => {
    const root = specRoot({ 'packages/x/test/fixtures/data.txt': OUTSIDE });

    const { code, stdout } = runCli(root);

    expect(code).toBe(1);
    expect(stdout).toContain('PII_IN_FIXTURE packages/x/test/fixtures/data.txt');
  });

  it('finds no address outside the example domains in this repository', async () => {
    expect(await piiIssues(REPO_ROOT)).toEqual([]);
  });
});

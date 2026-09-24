import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TRACE = fileURLToPath(new URL('../../scripts/trace.mjs', import.meta.url));

function check(fixtureName: string): { code: number | null; lines: string[] } {
  const root = fileURLToPath(new URL(`./fixtures/${fixtureName}`, import.meta.url));
  const run = spawnSync(process.execPath, [TRACE, '--check', '--root', root], { encoding: 'utf8' });
  return { code: run.status, lines: run.stdout.trimEnd().split('\n') };
}

describe('trace.check', () => {
  it('reports REQ_WITHOUT_TASK with the id of a MUST requirement that no task satisfies', () => {
    const { code, lines } = check('must-missing');

    expect(code).toBe(1);
    expect(lines).toContain(
      'REQ_WITHOUT_TASK specs/requirements.md: REQ-A-02 (MUST) appears in no task',
    );
    // A SHOULD requirement without a task is reported in the table, not as an error.
    expect(lines.some((line) => line.includes('REQ-A-03'))).toBe(false);
  });

  it('reports TASK_TEMPLATE_INVALID for a task without one of its template fields', () => {
    const { code, lines } = check('template-invalid');

    expect(code).toBe(1);
    expect(lines).toContain('TASK_TEMPLATE_INVALID specs/tasks.md: T-02 lacks `Verifica:`');
  });

  it('reports UNKNOWN_REQ for a task that cites a requirement absent from requirements.md', () => {
    const { code, lines } = check('unknown-req');

    expect(code).toBe(1);
    expect(lines).toContain('UNKNOWN_REQ specs/tasks.md: T-02 cites REQ-Z-99');
  });

  it('reports TRACE_TABLE_OUTDATED when the table differs from the generated one', () => {
    const { code, lines } = check('table-outdated');

    expect(code).toBe(1);
    expect(lines).toContain(
      'TRACE_TABLE_OUTDATED specs/tasks.md: run `node scripts/trace.mjs --write`',
    );
  });

  it('exits with code 0 when every MUST has a task and the table is up to date', () => {
    const { code, lines } = check('covered');

    expect(code).toBe(0);
    expect(lines).toEqual(['trace: OK (2/2 MUST, 0/1 SHOULD, 2 tasks)']);
  });
});

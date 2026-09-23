import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('passes every web test under the Angular CLI runner', () => {
  // Drop the parent Vitest variables so the child run starts as a standalone Vitest process.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('VITEST')),
  );
  const run = spawnSync(process.execPath, ['run-tests.mjs'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    env: { ...env, NO_COLOR: '1' },
    encoding: 'utf8',
  });

  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
});

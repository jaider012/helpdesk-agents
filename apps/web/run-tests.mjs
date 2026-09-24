// Runs the web tests with the Angular CLI (`ng test`: AOT build + Vitest in jsdom).
// `pnpm -F web test -- <pattern> [<pattern>…]` keeps the monorepo convention (specs/tasks.md §0):
// like `vitest run <filter>`, each pattern selects the test files whose path contains it.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const patterns = args.filter((arg) => !arg.startsWith('-'));
const options = args.filter((arg) => arg.startsWith('-'));

const testFiles = readdirSync(join(root, 'src'), { recursive: true })
  .map((file) =>
    relative(root, join(root, 'src', String(file)))
      .split(sep)
      .join('/'),
  )
  .filter((file) => file.endsWith('.test.ts'))
  .sort();

const selected =
  patterns.length === 0
    ? testFiles
    : testFiles.filter((file) => patterns.some((pattern) => file.includes(pattern)));

if (selected.length === 0) {
  console.error(`No test files found for: ${patterns.join(', ')}`);
  process.exit(1);
}

const ng = createRequire(import.meta.url).resolve('@angular/cli/bin/ng.js');
const include = patterns.length === 0 ? [] : selected.flatMap((file) => ['--include', file]);
const result = spawnSync(process.execPath, [ng, 'test', ...include, ...options], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);

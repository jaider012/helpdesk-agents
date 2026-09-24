// REQ-SEC-13: `.github/` and the test fixtures only use the example domains for email addresses.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { ValidationError } from './validate.ts';

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const EXAMPLE_DOMAINS = ['example.com', 'example.internal'];
// Folders that hold installed or generated files, never fixtures of this repository.
const SKIPPED = new Set(['node_modules', '.git', 'dist', 'coverage', 'data']);

function isExampleDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  return EXAMPLE_DOMAINS.some((example) => lower === example || lower.endsWith(`.${example}`));
}

/**
 * `PII_IN_FIXTURE` for each line of `text` with an address outside the example domains. The
 * message gives the line, never the address: the report must not spread it.
 */
export function emailIssues(path: string, text: string): ValidationError[] {
  return text.split('\n').flatMap((line, index) =>
    [...line.matchAll(EMAIL)].some(([, domain]) => !isExampleDomain(domain))
      ? [
          {
            code: 'PII_IN_FIXTURE' as const,
            path,
            message: `line ${index + 1} has an email address outside example.com and example.internal`,
          },
        ]
      : [],
  );
}

/** Files under `folder`, recursively, without the skipped folders. */
async function filesUnder(folder: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(
    entries
      .filter((entry) => !SKIPPED.has(entry.name))
      .map((entry) =>
        entry.isDirectory() ? filesUnder(join(folder, entry.name)) : [join(folder, entry.name)],
      ),
  );
  return nested.flat();
}

/** A fixture: a file under a `fixtures` folder inside a `test` or `tests` folder. */
function isFixture(path: string): boolean {
  const parts = path.split('/');
  const fixtures = parts.lastIndexOf('fixtures');
  return (
    fixtures > 0 && parts.slice(0, fixtures).some((part) => part === 'test' || part === 'tests')
  );
}

/** Scans `.github/` and every test fixture under `root` (REQ-SEC-13). */
export async function piiIssues(root: string): Promise<ValidationError[]> {
  const paths = (await filesUnder(root))
    .map((file) => relative(root, file).split(sep).join('/'))
    .filter((path) => path.startsWith('.github/') || isFixture(path))
    .sort();
  const issues = await Promise.all(
    paths.map(async (path) => emailIssues(path, await readFile(join(root, path), 'utf8'))),
  );
  return issues.flat();
}

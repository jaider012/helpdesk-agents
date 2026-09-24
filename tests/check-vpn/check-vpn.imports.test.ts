import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCRIPT_PATH } from './helpers.js';

const ALLOWED_MODULES = ['node:dns', 'node:net', 'node:perf_hooks'];

/** Returns every module specifier referenced by `source`: static imports, re-exports, `import()` and `require()`. */
function listModuleSpecifiers(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const patterns = [
    /\bimport\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
    // Dynamic imports and require() keep the raw argument, so a computed specifier never matches the allowlist.
    /\bimport\s*\(\s*([^)]*?)\s*\)/g,
    /\brequire\s*\(\s*([^)]*?)\s*\)/g,
  ];
  return patterns.flatMap((pattern) =>
    [...code.matchAll(pattern)].map((match) => match[1].replace(/^['"]|['"]$/g, '')),
  );
}

describe('check-vpn.imports', () => {
  it('detects static, re-exported, dynamic and require() specifiers', () => {
    const source = [
      "import dns from 'node:dns';",
      "import { connect } from 'node:net';",
      "import 'node:fs';",
      "export * from 'node:os';",
      "const cp = await import('node:child_process');",
      "const http = require('http');",
      'const dynamic = await import(name);',
      "// import x from 'commented-out';",
    ].join('\n');

    expect(listModuleSpecifiers(source)).toEqual([
      'node:dns',
      'node:net',
      'node:fs',
      'node:os',
      'node:child_process',
      'name',
      'http',
    ]);
  });

  it('imports only node:dns, node:net and node:perf_hooks', () => {
    const specifiers = listModuleSpecifiers(readFileSync(SCRIPT_PATH, 'utf8'));

    expect(specifiers.filter((specifier) => !ALLOWED_MODULES.includes(specifier))).toEqual([]);
  });
});

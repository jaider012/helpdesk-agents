import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function readJson(path: string): { engines?: { node?: string } } {
  return JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8'));
}

function parse(version: string): number[] {
  return version.split('.').map(Number);
}

function compare(a: number[], b: number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Whether `version` satisfies a range of `^x.y.z` and `>=x.y.z` clauses joined by `||`. */
function satisfies(version: string, range: string): boolean {
  const current = parse(version);
  return range.split('||').some((clause) => {
    const text = clause.trim();
    if (text.startsWith('>=')) return compare(current, parse(text.slice(2))) >= 0;
    if (text.startsWith('^')) {
      const minimum = parse(text.slice(1));
      return current[0] === minimum[0] && compare(current, minimum) >= 0;
    }
    throw new Error(`unsupported range clause: ${text}`);
  });
}

describe('node.version', () => {
  const nvmrc = readFileSync(`${ROOT}.nvmrc`, 'utf8').trim();
  const angularRange = readJson('apps/web/node_modules/@angular/cli/package.json').engines?.node;

  it('pins an exact Node version in .nvmrc', () => {
    expect(nvmrc).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('declares in the root engines the Node range of Angular CLI', () => {
    expect(angularRange).toBeDefined();
    expect(readJson('package.json').engines?.node).toBe(angularRange);
  });

  it('pins in .nvmrc a version inside that range', () => {
    expect(satisfies(nvmrc, angularRange ?? '')).toBe(true);
  });

  it('reads the range clauses', () => {
    const range = '^22.22.3 || ^24.15.0 || >=26.0.0';
    expect(satisfies('22.23.3', range)).toBe(true);
    expect(satisfies('22.19.0', range)).toBe(false);
    expect(satisfies('23.1.0', range)).toBe(false);
    expect(satisfies('24.15.0', range)).toBe(true);
    expect(satisfies('26.9.0', range)).toBe(true);
  });
});

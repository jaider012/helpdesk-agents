import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface Step {
  script?: string;
  task?: string;
  inputs?: Record<string, unknown>;
  condition?: string;
  continueOnError?: boolean;
}

interface Pipeline {
  trigger?: { branches?: { include?: string[] } };
  pool?: { vmImage?: string };
  steps?: Step[];
}

const pipeline = (): Pipeline =>
  parse(readFileSync(`${ROOT}azure-pipelines.yml`, 'utf8')) as Pipeline;

/** The index of the first script step that starts with `command`. */
function stepIndex(steps: Step[], command: string): number {
  return steps.findIndex(({ script }) => script?.trim().startsWith(command));
}

describe('ci.pipeline', () => {
  it('runs on every branch on ubuntu-latest', () => {
    const { trigger, pool } = pipeline();

    expect(trigger?.branches?.include).toEqual(['*']);
    expect(pool?.vmImage).toBe('ubuntu-latest');
  });

  it('installs the Node version of .nvmrc and the locked dependencies', () => {
    const steps = pipeline().steps ?? [];
    const node = steps.find(({ task }) => task === 'NodeTool@0');

    expect(node?.inputs).toMatchObject({ versionSource: 'fromFile', versionFilePath: '.nvmrc' });
    expect(stepIndex(steps, 'corepack enable')).toBeGreaterThan(steps.indexOf(node!));
    expect(stepIndex(steps, 'pnpm install --frozen-lockfile')).toBeGreaterThan(
      stepIndex(steps, 'corepack enable'),
    );
  });

  it.each([
    ['spec:validate (REQ-CI-01)', 'pnpm spec:validate'],
    ['lint (REQ-CI-03)', 'pnpm lint'],
    ['tests (REQ-CI-02)', 'pnpm test'],
    ['agent-spec coverage (REQ-CI-04)', 'pnpm -F agent-spec test -- --coverage'],
  ])('runs %s after the install and before the build, failing the build', (_, command) => {
    const steps = pipeline().steps ?? [];
    const index = stepIndex(steps, command);

    expect(index).toBeGreaterThan(stepIndex(steps, 'pnpm install --frozen-lockfile'));
    expect(index).toBeLessThan(stepIndex(steps, 'pnpm -r build'));
    expect(steps[index]?.continueOnError).not.toBe(true);
  });

  it('publishes the JUnit results and the Cobertura coverage even when a step fails', () => {
    const steps = pipeline().steps ?? [];
    const junit = steps.find(({ task }) => task === 'PublishTestResults@2');
    const coverage = steps.find(({ task }) => task === 'PublishCodeCoverageResults@2');

    expect(junit?.inputs).toMatchObject({ testResultsFormat: 'JUnit' });
    expect(steps[stepIndex(steps, 'pnpm test')]?.script).toContain(
      `--outputFile.junit=${String(junit?.inputs?.testResultsFiles)}`,
    );
    expect(coverage?.inputs).toMatchObject({
      summaryFileLocation: 'packages/agent-spec/coverage/cobertura-coverage.xml',
    });
    expect(junit?.condition).toBe('succeededOrFailed()');
    expect(coverage?.condition).toBe('succeededOrFailed()');
  });
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'agent-spec',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // `cobertura` feeds PublishCodeCoverageResults in azure-pipelines.yml.
      reporter: ['text', 'cobertura'],
      // REQ-CI-04: `pnpm -F agent-spec test -- --coverage` fails below this share of lines.
      thresholds: { lines: 90 },
    },
  },
});

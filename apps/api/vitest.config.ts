import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Load agent-spec from its TypeScript sources (`source` export condition), without a build.
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: { name: 'api', include: ['test/**/*.test.ts'] },
});

import { defineConfig } from 'vitest/config';

// The web tests need the Angular compiler, so they run through the Angular CLI (`run-tests.mjs`).
// The root `pnpm test` reaches them through this single bridge test.
export default defineConfig({
  test: { name: 'web', include: ['ng-test.bridge.test.ts'], testTimeout: 300_000 },
});

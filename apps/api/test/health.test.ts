import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { specStatus } from '../src/health/health.controller.js';
import { getJson, promptApp } from './prompt-helpers.js';

const INVALID_SPEC = fileURLToPath(new URL('./fixtures/invalid-spec', import.meta.url));

describe('health', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(() => close?.());

  it('returns the active LLM provider and the spec validation status', async () => {
    const { app } = await promptApp();
    close = () => app.close();
    await app.listen(0);

    const { status, body } = await getJson(app, '/health');

    expect(status).toBe(200);
    expect(body).toEqual({ llmProvider: 'fake', spec: { valid: true, errors: [] } });
  });

  it('reports the errors of a .github/ folder that breaks the rules', async () => {
    const status = await specStatus(INVALID_SPEC);

    expect(status.valid).toBe(false);
    expect(status.errors.length).toBeGreaterThan(0);
    expect(status.errors[0]).toMatch(/[A-Z_]+/);
  });
});

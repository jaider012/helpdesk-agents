import { describe, expect, it } from 'vitest';
import { redact } from '../src/redact/redact.js';

// Synthetic tokens built at runtime, so no secret-like literal lives in the repository.
const jwt = ['ey' + 'JhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ1c3JfYTFiMiJ9', 'c2ludGV0aWNv'].join('.');
const tokens = {
  jwt,
  openai: 'sk' + '-' + 'synthetic0'.repeat(3),
  github: 'gh' + 'p_' + 'x'.repeat(36),
  slack: 'xo' + 'xb-' + '0'.repeat(12),
  aws: 'AK' + 'IA' + 'X'.repeat(16),
  long: 'q'.repeat(20) + '_' + 'w'.repeat(20),
};

describe('redact.token', () => {
  it.each(Object.entries(tokens))('replaces the %s token-like string with [TOKEN]', (_, token) => {
    expect(redact(`Me pidieron pegar ${token} aquí.`)).toEqual({
      text: 'Me pidieron pegar [TOKEN] aquí.',
      counts: { TOKEN: 1 },
    });
  });

  it('keeps the Bearer keyword and replaces its token', () => {
    expect(redact('Authorization: Bearer abc.def-ghi').text).toBe('Authorization: Bearer [TOKEN]');
  });
});

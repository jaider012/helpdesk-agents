import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { compileSeverityMatrix } from '../src/graph/severity-matrix.js';
import { triage } from './triage-helpers.js';

const TRIAGE_AGENT = new URL('../../../.github/agents/triage.agent.md', import.meta.url);

describe('triage.severity-matrix', () => {
  it.each([
    ['high', 'high', 'P1'],
    ['high', 'medium', 'P2'],
    ['high', 'low', 'P3'],
    ['medium', 'high', 'P2'],
    ['medium', 'medium', 'P3'],
    ['medium', 'low', 'P4'],
    ['low', 'high', 'P3'],
    ['low', 'medium', 'P4'],
    ['low', 'low', 'P4'],
  ] as const)(
    'derives impact %s × urgency %s = %s from the matrix of triage.agent.md',
    async (impact, urgency, severity) => {
      const matrix = compileSeverityMatrix(await readFile(TRIAGE_AGENT, 'utf8'));

      expect(matrix(impact, urgency)).toBe(severity);
    },
  );

  it('reads the severity from the table, not from code', () => {
    const matrix = compileSeverityMatrix(
      [
        '## Matriz de severidad',
        '',
        '| impacto ↓ / urgencia → | high | medium | low |',
        '| --- | --- | --- | --- |',
        '| high | P2 | P2 | P3 |',
        '| medium | P2 | P3 | P4 |',
        '| low | P3 | P4 | P4 |',
      ].join('\n'),
    );

    expect(matrix('high', 'high')).toBe('P2');
  });

  it('gives P1 to a ticket with high impact and high urgency', async () => {
    const { classified } = await triage(
      'Nadie en la sede puede entrar a la intranet y la facturación de hoy está detenida.',
    );

    expect(classified).toMatchObject({
      severity: 'P1',
      urgency: 'high',
      entities: { businessImpact: 'high' },
    });
  });
});

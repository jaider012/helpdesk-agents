import { describe, expect, it } from 'vitest';
import { triage } from './triage-helpers.js';

describe('triage.category', () => {
  it.each([
    ['La VPN no me conecta desde esta mañana.', 'infra'],
    ['Me equivoqué varias veces con la contraseña y ahora mi cuenta está bloqueada.', 'access'],
    ['Cambié de celular y ya no tengo el autenticador.', 'access'],
    ['Necesito acceso de lectura a la carpeta finanzas-2026 para el cierre.', 'provisioning'],
    ['La impresora del piso 3 no imprime.', 'unknown'],
  ])('assigns exactly one category to «%s»', async (text, category) => {
    expect((await triage(text)).classified.category).toBe(category);
  });

  it('classifies the redacted text that the redact node produced, with triage.agent.md as system prompt', async () => {
    const { redacted, seen, systemPrompt, classified } = await triage(
      'Soy ana.demo@example.com y la VPN no conecta.',
    );

    expect(redacted).toMatchObject({
      rawText: '',
      redactedText: 'Soy [EMAIL] y la VPN no conecta.',
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].map((message) => [message.getType(), message.content])).toEqual([
      ['system', systemPrompt],
      ['human', 'Soy [EMAIL] y la VPN no conecta.'],
    ]);
    expect(JSON.stringify(classified)).not.toContain('ana.demo');
  });

  it('records the redaction counts and the classification in the audit log', async () => {
    const { audit } = await triage('Soy ana.demo@example.com y la VPN no conecta.');

    expect(audit).toMatchObject([
      { agent: 'redact', decision: 'redacted', data: { counts: { EMAIL: 1 } } },
      {
        agent: 'triage',
        decision: 'classified',
        data: { category: 'infra', issueType: 'vpn', severity: 'P3' },
      },
    ]);
  });
});

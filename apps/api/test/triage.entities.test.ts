import { describe, expect, it } from 'vitest';
import { SALT, triage } from './triage-helpers.js';
import { userRefFor } from '../src/redact/redact-node.js';

describe('triage.entities', () => {
  it('extracts service, issueType and businessImpact and keeps the userRef of the redact node', async () => {
    const { classified } = await triage('Soy ana.demo@example.com y la VPN no conecta.');

    expect(classified.entities).toEqual({
      userRef: userRefFor('ana.demo@example.com', SALT),
      service: 'VPN corporativa',
      issueType: 'vpn',
      businessImpact: 'medium',
    });
  });

  it.each([
    ['Mi cuenta está bloqueada por varios intentos.', 'lockout'],
    ['Olvidé mi contraseña.', 'password_reset'],
    ['No me llega el código MFA.', 'mfa'],
    ['Necesito una licencia de la herramienta de diagramas.', 'license'],
    ['Necesito permisos en el repositorio pagos-api.', 'repo_access'],
  ])('extracts the issueType of «%s»', async (text, issueType) => {
    expect((await triage(text)).classified.entities?.issueType).toBe(issueType);
  });

  it('extracts the access request of a provisioning ticket', async () => {
    const { classified } = await triage(
      'Necesito acceso de lectura a la carpeta finanzas-2026 para preparar el cierre del mes.',
    );

    expect(classified.entities?.request).toEqual({
      resource: 'carpeta finanzas-2026',
      accessLevel: 'read',
      justification: 'preparar el cierre del mes',
    });
  });
});

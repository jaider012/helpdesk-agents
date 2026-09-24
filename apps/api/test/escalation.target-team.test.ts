import { describe, expect, it } from 'vitest';
import { compileTeams } from '../src/graph/teams.js';
import type { GraphState } from '../src/graph/state.js';
import { newTicket, runtime } from './runtime-helpers.js';

const approvalRequired = (state: GraphState) => ({
  lastRoute: {
    from: 'provisioning' as const,
    to: 'escalation' as const,
    rule: 'R-P1',
    reason: 'approval_required' as const,
  },
  entities: state.entities,
});

describe('escalation.target-team', () => {
  it.each([
    ['La impresora del piso 3 no imprime.', 'Mesa de Ayuda N2'],
    ['Cambié de celular y ya no tengo el autenticador.', 'Identidad y Accesos'],
    ['La VPN no me conecta.', 'Infraestructura y Redes'],
    [
      'Necesito acceso de lectura a la carpeta finanzas-2026 para el cierre.',
      'Gestión de Accesos (aprobadores)',
    ],
  ])('assigns the team of the category from escalation.agent.md for «%s»', async (text, team) => {
    const { graph } = await runtime({ override: { provisioning: approvalRequired } });

    const final = await graph.invoke(newTicket('TCK-20260923-101500-tt1', text));

    expect(final.status).toBe('ESCALATED');
    expect(final.escalationPackage?.targetTeam).toBe(team);
  });

  it('compiles the category-to-team table', () => {
    const teams = compileTeams(
      '## Equipos de escalamiento\n\n| categoría | equipo |\n| --- | --- |\n| infra | Redes |\n',
    );

    expect(teams('infra')).toBe('Redes');
    expect(teams('access')).toBeUndefined();
  });
});

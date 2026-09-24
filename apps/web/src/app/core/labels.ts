import { AuditDecision, AuditEntry, Category, TicketStatus } from './contracts';

// Operator-facing texts in Spanish, without the jargon listed in .github/copilot-instructions.md.

export const CATEGORY_LABELS: Record<Category, string> = {
  access: 'Acceso e identidad',
  infra: 'Infraestructura y software',
  provisioning: 'Aprovisionamiento y permisos',
  unknown: 'Sin clasificar',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'Nuevo',
  TRIAGED: 'Clasificado',
  IN_PROGRESS: 'En curso',
  WAITING_USER: 'Esperando al usuario',
  RESOLVED: 'Resuelto',
  ESCALATED: 'Escalado',
  CLOSED: 'Cerrado',
};

/** Shown while a field is not known yet (for example, before triage). */
export const PENDING_LABEL = 'Pendiente';

/** Steps of the graph as the operator sees them in the timeline. */
export const ACTOR_LABELS: Record<AuditEntry['agent'], string> = {
  redact: 'Protección de datos',
  triage: 'Clasificación',
  diagnostics: 'Diagnóstico',
  provisioning: 'Aprovisionamiento',
  escalation: 'Escalamiento',
  runtime: 'Sistema',
  operator: 'Operador',
};

/** Label of a route target or source, including the end of the run (`END`). */
export function actorLabel(name: string | undefined): string {
  if (name === 'END') {
    return 'Fin del recorrido';
  }
  return (name && ACTOR_LABELS[name as AuditEntry['agent']]) || (name ?? PENDING_LABEL);
}

/** Label of a ticket status, falling back to the raw value if the api sends an unknown one. */
export function statusLabel(status: string | undefined): string {
  return (status && STATUS_LABELS[status as TicketStatus]) || (status ?? PENDING_LABEL);
}

export const DECISION_LABELS: Record<AuditDecision, string> = {
  ticket_created: 'Ticket creado',
  redacted: 'Datos personales ocultados',
  prompt_run: 'Plantilla ejecutada',
  node_started: 'Paso iniciado',
  node_finished: 'Paso terminado',
  classified: 'Ticket clasificado',
  routed: 'Derivación',
  transition: 'Cambio de estado',
  transition_rejected: 'Cambio de estado rechazado',
  tool_run: 'Comprobación ejecutada',
  skill_resource_unavailable: 'Comprobación no disponible',
  action_executed: 'Acción ejecutada',
  action_rejected: 'Acción rechazada',
  message_replaced: 'Mensaje sustituido por la plantilla',
  escalated: 'Caso escalado',
  llm_unavailable: 'Modelo de lenguaje no disponible',
  invalid_llm_output: 'Respuesta del modelo no válida',
  error: 'Error',
};

/** Label of an audit decision, falling back to the raw code if the api sends an unknown one. */
export function decisionLabel(decision: string): string {
  return DECISION_LABELS[decision as AuditDecision] ?? decision;
}

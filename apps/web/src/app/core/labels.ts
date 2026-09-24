import { Category, TicketStatus } from './contracts';

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

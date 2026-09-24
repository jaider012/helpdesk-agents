// Fields of TicketState (design §4) that the spec may reference.

/** Top-level keys of TicketState. */
export const TICKET_STATE_KEYS: ReadonlySet<string> = new Set([
  'ticketId',
  'channel',
  'createdAt',
  'redactedText',
  'category',
  'severity',
  'urgency',
  'entities',
  'findings',
  'actions',
  'status',
  'entryAgent',
  'nextAgent',
  'lastRoute',
  'escalation',
  'userMessage',
  'slaDueAt',
  'closeReason',
  'audit',
]);

/** Field paths a lifecycle predicate may reference. */
export const TICKET_STATE_PATHS: ReadonlySet<string> = new Set([
  'ticketId',
  'channel',
  'createdAt',
  'redactedText',
  'category',
  'severity',
  'urgency',
  'entities',
  'entities.userRef',
  'entities.service',
  'entities.issueType',
  'entities.businessImpact',
  'entities.request',
  'entities.request.resource',
  'entities.request.accessLevel',
  'entities.request.justification',
  'findings',
  'actions',
  'status',
  'entryAgent',
  'nextAgent',
  'lastRoute',
  'escalation',
  'escalation.reason',
  'escalation.targetTeam',
  'escalation.approvalRequest',
  'escalation.summary',
  'userMessage',
  'slaDueAt',
  'closeReason',
]);

/** List fields and the boolean flags a `lista[flag]` predicate may test. */
export const LIST_FLAGS: Readonly<Record<string, readonly string[]>> = {
  findings: ['conclusive'],
  actions: ['allowlisted'],
};

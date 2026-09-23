import { findTable } from './tables.ts';

export const LIFECYCLE_PATH = '.github/instructions/ticket-lifecycle.instructions.md';
export const TRANSITIONS_HEADING = '## Tabla de transiciones';
const TICKETS_GLOB = '**/tickets/**';

export const TICKET_STATUSES = [
  'NEW',
  'TRIAGED',
  'IN_PROGRESS',
  'WAITING_USER',
  'RESOLVED',
  'ESCALATED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** A predicate of the `campos obligatorios` column (design §3.1). */
export type FieldPredicate =
  | { kind: 'present'; path: string }
  | { kind: 'not-equal'; path: string; value: string }
  | { kind: 'some-flag'; path: string; flag: string };

export interface TransitionSpec {
  /** Value of the `#` column (`T1`) or `row <n>`. */
  id: string;
  from: TicketStatus;
  to: TicketStatus;
  required: FieldPredicate[];
}

export interface StateMachineSpec {
  transitions: TransitionSpec[];
}

export interface LifecycleIssue {
  code: 'LIFECYCLE_APPLYTO_MISSING' | 'LIFECYCLE_TABLE_INVALID' | 'UNKNOWN_STATUS';
  message: string;
}

// TicketState fields (design §4) that a predicate may reference.
const TICKET_STATE_PATHS = new Set([
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
const LIST_FLAGS: Record<string, readonly string[]> = {
  findings: ['conclusive'],
  actions: ['allowlisted'],
};

const COLUMNS = { from: 'desde', to: 'hacia', required: 'campos obligatorios' } as const;

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

function stripCode(cell: string): string {
  return cell.trim().replace(/^`|`$/g, '').trim();
}

/** Parses one predicate or explains why it is not a TicketState predicate. */
function parsePredicate(text: string): FieldPredicate | string {
  const notEqual = /^([A-Za-z][\w.]*)!=(\w+)$/.exec(text);
  if (notEqual) {
    const [, path, value] = notEqual;
    return TICKET_STATE_PATHS.has(path)
      ? { kind: 'not-equal', path, value }
      : `\`${text}\` is not a TicketState field`;
  }
  const someFlag = /^([A-Za-z][\w.]*)\[(\w+)\]$/.exec(text);
  if (someFlag) {
    const [, path, flag] = someFlag;
    return LIST_FLAGS[path]?.includes(flag)
      ? { kind: 'some-flag', path, flag }
      : `\`${text}\` is not a TicketState list flag`;
  }
  if (/^[A-Za-z]\w*(\.[A-Za-z]\w*)*$/.test(text)) {
    return TICKET_STATE_PATHS.has(text)
      ? { kind: 'present', path: text }
      : `\`${text}\` is not a TicketState field`;
  }
  return `\`${text}\` is not a field predicate`;
}

/** Compiles the transitions table of `ticket-lifecycle.instructions.md` (design §3.1). */
export function compileLifecycle(body: string): {
  spec: StateMachineSpec;
  issues: LifecycleIssue[];
} {
  const invalid = (message: string): LifecycleIssue => ({
    code: 'LIFECYCLE_TABLE_INVALID',
    message,
  });
  const table = findTable(body, TRANSITIONS_HEADING);
  if (!table) {
    return {
      spec: { transitions: [] },
      issues: [invalid(`no GFM table under the heading \`${TRANSITIONS_HEADING}\``)],
    };
  }
  const column = (name: string) => table.header.indexOf(name);
  const missing = Object.values(COLUMNS).filter((name) => column(name) === -1);
  if (missing.length > 0) {
    return {
      spec: { transitions: [] },
      issues: missing.map((name) => invalid(`the transitions table lacks the column \`${name}\``)),
    };
  }

  const issues: LifecycleIssue[] = [];
  const transitions: TransitionSpec[] = [];
  table.rows.forEach((row, index) => {
    const id = column('#') === -1 ? `row ${index + 1}` : stripCode(row[column('#')] ?? '');
    const [from, to] = [COLUMNS.from, COLUMNS.to].map((name) => stripCode(row[column(name)] ?? ''));
    for (const status of [from, to].filter((value) => !isTicketStatus(value))) {
      issues.push({
        code: 'UNKNOWN_STATUS',
        message: `${id}: \`${status}\` is not a TicketStatus`,
      });
    }
    const cells = (row[column(COLUMNS.required)] ?? '').split(',').map(stripCode).filter(Boolean);
    if (cells.length === 0) issues.push(invalid(`${id}: \`${COLUMNS.required}\` is empty`));
    const required: FieldPredicate[] = [];
    for (const parsed of cells.map(parsePredicate)) {
      if (typeof parsed === 'string') issues.push(invalid(`${id}: ${parsed}`));
      else required.push(parsed);
    }
    if (isTicketStatus(from) && isTicketStatus(to)) transitions.push({ id, from, to, required });
  });
  return { spec: { transitions }, issues };
}

/** Checks the frontmatter and the transitions table of `ticket-lifecycle.instructions.md`. */
export function lifecycleIssues(
  frontmatter: Record<string, unknown>,
  body: string,
): LifecycleIssue[] {
  const { applyTo } = frontmatter;
  const globs = typeof applyTo === 'string' ? applyTo.split(',').map((glob) => glob.trim()) : [];
  const applyToIssues: LifecycleIssue[] = globs.includes(TICKETS_GLOB)
    ? []
    : [
        {
          code: 'LIFECYCLE_APPLYTO_MISSING',
          message: `applyTo must include the glob \`${TICKETS_GLOB}\``,
        },
      ];
  return [...applyToIssues, ...compileLifecycle(body).issues];
}

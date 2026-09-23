#!/usr/bin/env node
// Traceability between specs/requirements.md and specs/tasks.md (design §13, REQ-VAL-07).
//   --check  report template errors, unknown or uncovered requirements and an outdated table (exit 1)
//   --write  regenerate the table between the TRACE markers of specs/tasks.md
//   --root   repository root (default: current directory)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const REQUIREMENTS = 'specs/requirements.md';
const TASKS = 'specs/tasks.md';
const TABLE = /<!-- TRACE:START -->[\s\S]*?<!-- TRACE:END -->/;
const TEMPLATE_FIELDS = ['Hecho cuando:', 'Verifica:', 'Bloqueada por:'];

function parseRequirements(text) {
  return [...text.matchAll(/^#### (REQ-[A-Z0-9.-]+) · (MUST|SHOULD)$/gm)].map(
    ([, id, priority]) => ({ id, priority }),
  );
}

/** Each task: its id, the requirements of its `Satisface:` and the template fields it lacks. */
function parseTasks(text) {
  const lines = text.split('\n');
  const tasks = [];
  lines.forEach((line, index) => {
    const header = /^- \[[ x]\] (T-\d+) · (.*)$/.exec(line);
    if (!header) return;
    const satisfies = / · Satisface: (.+)$/.exec(header[2]);
    const body = [];
    for (let next = index + 1; lines[next]?.startsWith('  '); next += 1)
      body.push(lines[next].trim());
    tasks.push({
      id: header[1],
      reqs: satisfies ? satisfies[1].split(',').map((req) => req.trim()) : [],
      missing: [
        ...(satisfies ? [] : ['Satisface:']),
        ...TEMPLATE_FIELDS.filter((field) => !body.some((bodyLine) => bodyLine.startsWith(field))),
      ],
    });
  });
  return tasks;
}

function taskNumber(taskId) {
  return Number(taskId.slice(2));
}

function tasksByRequirement(requirements, tasks) {
  const byReq = new Map(requirements.map(({ id }) => [id, new Set()]));
  for (const task of tasks) for (const req of task.reqs) byReq.get(req)?.add(task.id);
  return new Map(
    [...byReq].map(([req, ids]) => [req, [...ids].sort((a, b) => taskNumber(a) - taskNumber(b))]),
  );
}

function coverage(requirements, byReq, priority) {
  const ofPriority = requirements.filter((req) => req.priority === priority);
  const covered = ofPriority.filter(({ id }) => byReq.get(id).length > 0);
  return `${covered.length}/${ofPriority.length}`;
}

function renderTable(requirements, tasks, byReq) {
  return [
    '<!-- TRACE:START -->',
    `Cobertura: **${coverage(requirements, byReq, 'MUST')} MUST** y **${coverage(requirements, byReq, 'SHOULD')} SHOULD** con al menos una tarea. ${tasks.length} tareas.`,
    '',
    '| REQ | Prioridad | Tareas |',
    '| --- | --- | --- |',
    ...requirements.map(
      ({ id, priority }) => `| ${id} | ${priority} | ${byReq.get(id).join(', ') || '—'} |`,
    ),
    '<!-- TRACE:END -->',
  ].join('\n');
}

function check(requirements, tasks, byReq, tasksText, table) {
  const known = new Set(requirements.map(({ id }) => id));
  const errors = [];
  for (const task of tasks) {
    for (const field of task.missing) {
      errors.push(`TASK_TEMPLATE_INVALID ${TASKS}: ${task.id} lacks \`${field}\``);
    }
    for (const req of task.reqs.filter((id) => !known.has(id))) {
      errors.push(`UNKNOWN_REQ ${TASKS}: ${task.id} cites ${req}`);
    }
  }
  for (const { id } of requirements.filter(({ priority }) => priority === 'MUST')) {
    if (byReq.get(id).length === 0) {
      errors.push(`REQ_WITHOUT_TASK ${REQUIREMENTS}: ${id} (MUST) appears in no task`);
    }
  }
  if (tasksText.match(TABLE)?.[0] !== table) {
    errors.push(`TRACE_TABLE_OUTDATED ${TASKS}: run \`node scripts/trace.mjs --write\``);
  }
  return errors;
}

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
    root: { type: 'string', default: process.cwd() },
  },
});
if (values.check === values.write) {
  console.error('usage: node scripts/trace.mjs (--check | --write) [--root <dir>]');
  process.exit(2);
}

const tasksPath = join(values.root, TASKS);
const tasksText = readFileSync(tasksPath, 'utf8');
const requirements = parseRequirements(readFileSync(join(values.root, REQUIREMENTS), 'utf8'));
const tasks = parseTasks(tasksText);
const byReq = tasksByRequirement(requirements, tasks);
const table = renderTable(requirements, tasks, byReq);
const summary = `${coverage(requirements, byReq, 'MUST')} MUST, ${coverage(requirements, byReq, 'SHOULD')} SHOULD, ${tasks.length} tasks`;

if (values.write) {
  writeFileSync(
    tasksPath,
    TABLE.test(tasksText) ? tasksText.replace(TABLE, table) : `${tasksText}\n${table}\n`,
  );
  console.log(`trace: table written (${summary})`);
} else {
  const errors = check(requirements, tasks, byReq, tasksText, table);
  for (const error of errors) console.log(error);
  console.log(
    errors.length === 0
      ? `trace: OK (${summary})`
      : `trace: ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`,
  );
  process.exitCode = errors.length === 0 ? 0 : 1;
}

import type { FieldPredicate } from 'agent-spec';

function valueAt(state: object, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], state);
}

/** Defined and not empty: a text other than `''`, a list with elements (design §3.1). */
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Whether `state` meets one predicate of the `campos obligatorios` column. */
export function holds(predicate: FieldPredicate, state: object): boolean {
  const value = valueAt(state, predicate.path);
  switch (predicate.kind) {
    case 'present':
      return isPresent(value);
    case 'not-equal':
      return isPresent(value) && String(value) !== predicate.value;
    case 'some-flag':
      return (
        Array.isArray(value) &&
        value.some((item) => (item as Record<string, unknown> | null)?.[predicate.flag] === true)
      );
  }
}

/** The predicate as written in the table: `path`, `path!=value` or `list[flag]`. */
export function describePredicate(predicate: FieldPredicate): string {
  switch (predicate.kind) {
    case 'present':
      return predicate.path;
    case 'not-equal':
      return `${predicate.path}!=${predicate.value}`;
    case 'some-flag':
      return `${predicate.path}[${predicate.flag}]`;
  }
}

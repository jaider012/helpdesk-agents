// `pnpm spec:validate`: validates the `.github/` spec and exits with 0 (valid) or 1 (errors).
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadSpec } from './load.ts';
import { piiIssues } from './pii.ts';
import { formatError, validateSpec } from './validate.ts';

const { values } = parseArgs({ options: { root: { type: 'string', default: process.cwd() } } });

const root = resolve(values.root);
const errors = [...validateSpec(await loadSpec(root)), ...(await piiIssues(root))];
for (const error of errors) console.log(formatError(error));
console.log(
  errors.length === 0
    ? 'spec:validate: OK'
    : `spec:validate: ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`,
);
process.exitCode = errors.length === 0 ? 0 : 1;

#!/usr/bin/env node
/**
 * check-vpn.js — connectivity checks for the `vpn-diagnostics` skill.
 *
 * Usage:
 *   node check-vpn.js --target <host>:<port> [--timeout-ms <n>] [--latency-threshold-ms <n>] [--deadline-ms <n>]
 *
 * Contract (specs/design.md §6.2):
 *   - Imports only node:dns, node:net and node:perf_hooks. No external dependencies.
 *   - Prints exactly one JSON object to stdout with the keys `ok`, `checks` and `summary`.
 *   - Exit codes: 0 every check passed · 1 at least one check failed · 2 invalid arguments,
 *     internal error or total deadline exceeded.
 */

const EXIT_ERROR = 2;

class InvalidArgsError extends Error {
  code = 'INVALID_ARGS';
}

const OPTION_PARSERS = new Map([['--target', parseTarget]]);

function parseTarget(value) {
  const match = /^([^\s:]+):(\d{1,5})$/.exec(value);
  if (!match) throw new InvalidArgsError('--target must be <host>:<port>');
  const port = Number(match[2]);
  if (port < 1 || port > 65535) throw new InvalidArgsError('--target port must be 1-65535');
  return { host: match[1], port };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const parse = OPTION_PARSERS.get(flag);
    if (!parse) throw new InvalidArgsError(`unknown argument: ${flag}`);
    if (argv[i + 1] === undefined) throw new InvalidArgsError(`${flag} requires a value`);
    options[flag.slice(2)] = parse(argv[i + 1]);
  }
  if (!options.target) throw new InvalidArgsError('--target <host>:<port> is required');
  return options;
}

async function runChecks() {
  throw new Error('checks are not implemented');
}

function errorResult(error) {
  const code = error instanceof InvalidArgsError ? error.code : 'INTERNAL';
  return {
    ok: false,
    checks: [],
    summary: `${code}: ${error.message}`,
    error: { code, message: error.message },
  };
}

function emit(result, exitCode) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitCode;
}

async function main(argv) {
  try {
    const options = parseArgs(argv);
    const { result, exitCode } = await runChecks(options);
    emit(result, exitCode);
  } catch (error) {
    emit(errorResult(error), EXIT_ERROR);
  }
}

await main(process.argv.slice(2));

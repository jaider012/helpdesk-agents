#!/usr/bin/env node
/**
 * check-vpn.js — connectivity checks for the `vpn-diagnostics` skill.
 *
 * Usage:
 *   node check-vpn.js --target <host>:<port> [--timeout-ms <n>] [--latency-threshold-ms <n>] [--deadline-ms <n>]
 *
 * Contract (specs/design.md §6.2):
 *   - Imports only node:dns, node:net and node:perf_hooks. No external dependencies.
 *   - Prints exactly one JSON object to stdout with the keys `version`, `ok`, `target`, `checks`,
 *     `summary`, `error` and `durationMs`.
 *   - Exit codes: 0 every check passed · 1 at least one check failed · 2 invalid arguments,
 *     internal error or total deadline exceeded.
 */
import { promises as dns } from 'node:dns';
import net from 'node:net';
import { performance } from 'node:perf_hooks';

// Must stay below the 10 s timeout declared in SKILL.md, so the script reports DEADLINE_EXCEEDED
// before the runtime kills it (the spec validator reads this line).
const DEFAULT_DEADLINE_MS = 9000;

const OUTPUT_VERSION = 1;
const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_ERROR = 2;

class CodedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const invalidArgs = (message) => new CodedError('INVALID_ARGS', message);

const DEFAULT_OPTIONS = {
  timeoutMs: 3000,
  latencyThresholdMs: 300,
  deadlineMs: DEFAULT_DEADLINE_MS,
};

const OPTIONS = new Map([
  ['--target', { key: 'target', parse: parseTarget }],
  ['--timeout-ms', { key: 'timeoutMs', parse: parsePositiveMilliseconds }],
  ['--latency-threshold-ms', { key: 'latencyThresholdMs', parse: parseMilliseconds }],
  ['--deadline-ms', { key: 'deadlineMs', parse: parseDeadline }],
]);

function parseMilliseconds(value, flag) {
  if (!/^\d+$/.test(value)) throw invalidArgs(`${flag} must be a non-negative integer`);
  return Number(value);
}

function parsePositiveMilliseconds(value, flag) {
  const milliseconds = parseMilliseconds(value, flag);
  if (milliseconds === 0) throw invalidArgs(`${flag} must be greater than 0`);
  return milliseconds;
}

function parseDeadline(value, flag) {
  const milliseconds = parsePositiveMilliseconds(value, flag);
  if (milliseconds > DEFAULT_DEADLINE_MS) {
    throw invalidArgs(`${flag} must not exceed ${DEFAULT_DEADLINE_MS}`);
  }
  return milliseconds;
}

function parseTarget(value) {
  const match = /^([^\s:]+):(\d{1,5})$/.exec(value);
  if (!match) throw invalidArgs('--target must be <host>:<port>');
  const port = Number(match[2]);
  if (port < 1 || port > 65535) throw invalidArgs('--target port must be 1-65535');
  return { host: match[1], port };
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const option = OPTIONS.get(flag);
    if (!option) throw invalidArgs(`unknown argument: ${flag}`);
    if (argv[i + 1] === undefined) throw invalidArgs(`${flag} requires a value`);
    options[option.key] = option.parse(argv[i + 1], flag);
  }
  if (!options.target) throw invalidArgs('--target <host>:<port> is required');
  return options;
}

/**
 * Rounds up to 0.1 ms: any positive duration stays above 0, and comparing the reported value with
 * an integer threshold gives the same result as comparing the raw measurement.
 */
function elapsedMs(start) {
  return Math.ceil((performance.now() - start) * 10) / 10;
}

function skipped(name, reason) {
  return { name, status: 'skip', durationMs: 0, reason };
}

/** Rejects with `error` when `promise` does not settle within `timeoutMs`. */
function withTimeout(promise, timeoutMs, error) {
  let timer;
  const expired = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(error), timeoutMs);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

async function checkDns(host, timeoutMs) {
  const start = performance.now();
  try {
    const addresses = await withTimeout(
      dns.lookup(host, { all: true }),
      timeoutMs,
      new CodedError('timeout', 'dns lookup timed out'),
    );
    return { check: { name: 'dns', status: 'pass', durationMs: elapsedMs(start) }, addresses };
  } catch (error) {
    const reason = error.code ?? 'lookup_failed';
    return { check: { name: 'dns', status: 'fail', durationMs: elapsedMs(start), reason } };
  }
}

function checkTcp({ host, port }, addresses, timeoutMs) {
  // Reuse the DNS answer so the measured time covers only the TCP handshake.
  const lookup = (_hostname, options, callback) =>
    options.all
      ? callback(null, addresses)
      : callback(null, addresses[0].address, addresses[0].family);
  const start = performance.now();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, lookup });
    const finish = (status, reason) => {
      const durationMs = elapsedMs(start);
      clearTimeout(timer);
      socket.destroy();
      resolve(
        reason ? { name: 'tcp', status, durationMs, reason } : { name: 'tcp', status, durationMs },
      );
    };
    const timer = setTimeout(() => finish('fail', 'timeout'), timeoutMs);
    socket.once('connect', () => finish('pass'));
    socket.once('error', (error) => finish('fail', error.code ?? 'connect_failed'));
  });
}

/** The latency is the TCP handshake time, reported as the `durationMs` of the latency check. */
function checkLatency(tcp, thresholdMs) {
  const latency = { name: 'latency', status: 'pass', durationMs: tcp.durationMs };
  return tcp.durationMs > thresholdMs
    ? { ...latency, status: 'fail', reason: 'threshold_exceeded' }
    : latency;
}

/** Appends each check to `checks` as soon as it finishes, so a deadline can report partial work. */
async function runChecks({ target, timeoutMs, latencyThresholdMs }, checks) {
  const resolution = await checkDns(target.host, timeoutMs);
  checks.push(resolution.check);
  if (resolution.check.status === 'fail') {
    checks.push(skipped('tcp', 'dns_failed'), skipped('latency', 'dns_failed'));
    return;
  }
  const tcp = await checkTcp(target, resolution.addresses, timeoutMs);
  checks.push(tcp);
  checks.push(
    tcp.status === 'pass'
      ? checkLatency(tcp, latencyThresholdMs)
      : skipped('latency', 'tcp_failed'),
  );
}

function describeCheck({ name, status, durationMs, reason }) {
  const details = [];
  if (status === 'fail') details.push(reason);
  if (name === 'latency' && status !== 'skip') details.push(`${durationMs} ms`);
  return details.length > 0 ? `${name} ${status} (${details.join(', ')})` : `${name} ${status}`;
}

function buildResult({ target, checks, error, start }) {
  const parts = checks.map(describeCheck);
  if (error) parts.push(`${error.code}: ${error.message}`);
  return {
    version: OUTPUT_VERSION,
    ok: error === null && checks.every((check) => check.status === 'pass'),
    target,
    checks,
    summary: parts.join(' · '),
    error,
    durationMs: elapsedMs(start),
  };
}

function emit(result, exitCode) {
  // Exit as soon as stdout is flushed: a timed-out DNS lookup cannot be cancelled and would keep
  // the process alive until the resolver gives up.
  process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(exitCode));
}

async function main(argv) {
  const start = performance.now();
  const checks = [];
  let target = null;
  try {
    const options = parseArgs(argv);
    target = options.target;
    await withTimeout(
      runChecks(options, checks),
      options.deadlineMs,
      new CodedError('DEADLINE_EXCEEDED', `total execution exceeded ${options.deadlineMs} ms`),
    );
    const result = buildResult({ target, checks, error: null, start });
    emit(result, result.ok ? EXIT_OK : EXIT_FAILED);
  } catch (error) {
    const code = error instanceof CodedError ? error.code : 'INTERNAL';
    const failure = { code, message: error instanceof Error ? error.message : String(error) };
    emit(buildResult({ target, checks: [...checks], error: failure, start }), EXIT_ERROR);
  }
}

await main(process.argv.slice(2));

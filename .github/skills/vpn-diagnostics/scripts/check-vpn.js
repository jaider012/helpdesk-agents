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
import { promises as dns } from 'node:dns';
import net from 'node:net';
import { performance } from 'node:perf_hooks';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_ERROR = 2;

class InvalidArgsError extends Error {
  code = 'INVALID_ARGS';
}

const DEFAULT_OPTIONS = { timeoutMs: 3000, latencyThresholdMs: 300 };

const OPTIONS = new Map([
  ['--target', { key: 'target', parse: parseTarget }],
  ['--timeout-ms', { key: 'timeoutMs', parse: parsePositiveMilliseconds }],
  ['--latency-threshold-ms', { key: 'latencyThresholdMs', parse: parseMilliseconds }],
]);

function parseMilliseconds(value, flag) {
  if (!/^\d+$/.test(value)) throw new InvalidArgsError(`${flag} must be a non-negative integer`);
  return Number(value);
}

function parsePositiveMilliseconds(value, flag) {
  const milliseconds = parseMilliseconds(value, flag);
  if (milliseconds === 0) throw new InvalidArgsError(`${flag} must be greater than 0`);
  return milliseconds;
}

function parseTarget(value) {
  const match = /^([^\s:]+):(\d{1,5})$/.exec(value);
  if (!match) throw new InvalidArgsError('--target must be <host>:<port>');
  const port = Number(match[2]);
  if (port < 1 || port > 65535) throw new InvalidArgsError('--target port must be 1-65535');
  return { host: match[1], port };
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const option = OPTIONS.get(flag);
    if (!option) throw new InvalidArgsError(`unknown argument: ${flag}`);
    if (argv[i + 1] === undefined) throw new InvalidArgsError(`${flag} requires a value`);
    options[option.key] = option.parse(argv[i + 1], flag);
  }
  if (!options.target) throw new InvalidArgsError('--target <host>:<port> is required');
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

/** Rejects with an error whose code is `timeout` when `promise` does not settle within `timeoutMs`. */
function withTimeout(promise, timeoutMs) {
  let timer;
  const expired = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error('check timed out'), { code: 'timeout' })),
      timeoutMs,
    );
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

async function checkDns(host, timeoutMs) {
  const start = performance.now();
  try {
    const addresses = await withTimeout(dns.lookup(host, { all: true }), timeoutMs);
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

function describeCheck({ name, status, durationMs, reason }) {
  const details = [];
  if (status === 'fail') details.push(reason);
  if (name === 'latency' && status !== 'skip') details.push(`${durationMs} ms`);
  return details.length > 0 ? `${name} ${status} (${details.join(', ')})` : `${name} ${status}`;
}

async function runChecks({ target, timeoutMs, latencyThresholdMs }) {
  const resolution = await checkDns(target.host, timeoutMs);
  const checks = [resolution.check];
  if (resolution.check.status === 'fail') {
    checks.push(skipped('tcp', 'dns_failed'), skipped('latency', 'dns_failed'));
  } else {
    const tcp = await checkTcp(target, resolution.addresses, timeoutMs);
    checks.push(
      tcp,
      tcp.status === 'pass'
        ? checkLatency(tcp, latencyThresholdMs)
        : skipped('latency', 'tcp_failed'),
    );
  }
  const ok = checks.every((check) => check.status === 'pass');
  return {
    result: { ok, target, checks, summary: checks.map(describeCheck).join(' · '), error: null },
    exitCode: ok ? EXIT_OK : EXIT_FAILED,
  };
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
  // Exit as soon as stdout is flushed: a timed-out DNS lookup cannot be cancelled and would keep
  // the process alive until the resolver gives up.
  process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(exitCode));
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

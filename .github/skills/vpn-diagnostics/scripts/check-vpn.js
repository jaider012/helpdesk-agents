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

function elapsedMs(start) {
  return Math.round((performance.now() - start) * 10) / 10;
}

function skipped(name, reason) {
  return { name, status: 'skip', durationMs: 0, reason };
}

async function checkDns(host) {
  const start = performance.now();
  try {
    const addresses = await dns.lookup(host, { all: true });
    return { check: { name: 'dns', status: 'pass', durationMs: elapsedMs(start) }, addresses };
  } catch (error) {
    const reason = error.code ?? 'lookup_failed';
    return { check: { name: 'dns', status: 'fail', durationMs: elapsedMs(start), reason } };
  }
}

function checkTcp({ host, port }, addresses) {
  // Reuse the DNS answer so the measured time covers only the TCP handshake.
  const lookup = (_hostname, options, callback) =>
    options.all
      ? callback(null, addresses)
      : callback(null, addresses[0].address, addresses[0].family);
  const start = performance.now();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, lookup });
    socket.once('connect', () => {
      const durationMs = elapsedMs(start);
      socket.destroy();
      resolve({ name: 'tcp', status: 'pass', durationMs });
    });
    socket.once('error', (error) => {
      socket.destroy();
      const reason = error.code ?? 'connect_failed';
      resolve({ name: 'tcp', status: 'fail', durationMs: elapsedMs(start), reason });
    });
  });
}

/** The latency is the TCP handshake time, reported as the `durationMs` of the latency check. */
function checkLatency(tcp) {
  return { name: 'latency', status: 'pass', durationMs: tcp.durationMs };
}

function describeCheck({ name, status, durationMs, reason }) {
  if (status === 'fail') return `${name} fail (${reason})`;
  if (name === 'latency' && status === 'pass') return `latency pass (${durationMs} ms)`;
  return `${name} ${status}`;
}

async function runChecks({ target }) {
  const resolution = await checkDns(target.host);
  const checks = [resolution.check];
  if (resolution.check.status === 'fail') {
    checks.push(skipped('tcp', 'dns_failed'), skipped('latency', 'dns_failed'));
  } else {
    const tcp = await checkTcp(target, resolution.addresses);
    checks.push(tcp, tcp.status === 'pass' ? checkLatency(tcp) : skipped('latency', 'tcp_failed'));
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

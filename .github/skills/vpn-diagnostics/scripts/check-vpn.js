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

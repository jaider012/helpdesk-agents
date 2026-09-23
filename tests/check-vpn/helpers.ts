import { spawn } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

export const SCRIPT_PATH = fileURLToPath(
  new URL('../../.github/skills/vpn-diagnostics/scripts/check-vpn.js', import.meta.url),
);

export interface CheckVpnRun {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs check-vpn.js as a child process, the same way the runtime and the skill do. */
export function runCheckVpn(args: readonly string[]): Promise<CheckVpnRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

export interface CheckOutput {
  name: 'dns' | 'tcp' | 'latency';
  status: 'pass' | 'fail' | 'skip';
  durationMs: number;
  reason?: string;
}

export interface CheckVpnOutput {
  ok: boolean;
  checks: CheckOutput[];
  summary: string;
  error: { code: string; message: string } | null;
  [key: string]: unknown;
}

/** Parses stdout as exactly one JSON value; a second object or trailing text makes it throw. */
export function parseOutput(run: CheckVpnRun): CheckVpnOutput {
  return JSON.parse(run.stdout) as CheckVpnOutput;
}

export function findCheck(output: CheckVpnOutput, name: CheckOutput['name']): CheckOutput {
  const check = output.checks.find((candidate) => candidate.name === name);
  if (!check) throw new Error(`check ${name} missing from ${JSON.stringify(output.checks)}`);
  return check;
}

export interface LocalTcpServer {
  port: number;
  connectionCount: () => number;
  close: () => Promise<void>;
}

/** Starts a TCP server on 127.0.0.1 that accepts connections and counts them. */
export async function startTcpServer(): Promise<LocalTcpServer> {
  let connections = 0;
  const server = createServer((socket) => {
    connections += 1;
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    connectionCount: () => connections,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Returns a local port with nothing listening on it. */
export async function closedPort(): Promise<number> {
  const server = await startTcpServer();
  await server.close();
  return server.port;
}

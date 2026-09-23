import { spawn } from 'node:child_process';
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

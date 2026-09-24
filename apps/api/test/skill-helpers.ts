import { createServer, type AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { loadSpec } from 'agent-spec';
import { compileSkillScripts, type SkillScript } from '../src/tools/skill-runner.js';
import { REPO_ROOT } from './lifecycle-helpers.js';

/** A script that blocks its event loop, so it never reaches its own deadline. */
export const BLOCKING_SCRIPT = fileURLToPath(
  new URL('./fixtures/skills/block-event-loop.js', import.meta.url),
);

/** A script that exits with code 0 and prints text instead of JSON. */
export const TEXT_SCRIPT = fileURLToPath(
  new URL('./fixtures/skills/print-text.js', import.meta.url),
);

/** check-vpn.js as the runtime compiles it from the real vpn-diagnostics skill. */
export async function checkVpnScript(): Promise<SkillScript> {
  const scripts = compileSkillScripts(await loadSpec(REPO_ROOT));
  const script = scripts.find(({ skill }) => skill === 'vpn-diagnostics');
  if (!script) throw new Error('the spec has no vpn-diagnostics script');
  return script;
}

/** Starts a TCP server on 127.0.0.1 that accepts connections and closes them. */
export async function startTcpServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((socket) => socket.destroy());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** A local port with nothing listening on it. */
export async function closedPort(): Promise<number> {
  const server = await startTcpServer();
  await server.close();
  return server.port;
}

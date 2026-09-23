import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadSpec } from 'agent-spec';
import { TicketStateMachine } from '../src/tickets/state-machine.js';

export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** The state machine compiled from the real `.github/` spec. */
export async function realStateMachine(): Promise<TicketStateMachine> {
  return TicketStateMachine.fromBundle(await loadSpec(REPO_ROOT));
}

/** The state machine compiled from a fixture Markdown body. */
export async function fixtureStateMachine(name: string): Promise<TicketStateMachine> {
  const body = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  return TicketStateMachine.fromLifecycle(body);
}

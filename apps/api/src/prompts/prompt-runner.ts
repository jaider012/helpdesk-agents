import { randomInt } from 'node:crypto';
import { promptName, promptVariables, type AgentName, type SpecBundle } from 'agent-spec';
import type { AuditLog } from '../audit/audit-log.js';
import type { buildGraph } from '../graph/build.js';
import { fromTicketState, type GraphState } from '../graph/state.js';
import type { Channel } from '../tickets/ticket-state.js';
import type { TicketStore } from '../tickets/ticket-store.js';

export type CompiledGraph = ReturnType<typeof buildGraph>;

/** A `.prompt.md` file as the api runs it (design §7). */
export interface PromptDefinition {
  name: string;
  agent: AgentName;
  template: string;
  variables: string[];
}

/** The prompt files of the spec, by name. */
export function compilePrompts(bundle: SpecBundle): Map<string, PromptDefinition> {
  const prompts = new Map<string, PromptDefinition>();
  for (const file of bundle.files) {
    if (file.kind !== 'prompt' || !file.frontmatter.ok) continue;
    const { data, body } = file.frontmatter;
    const name = promptName(file);
    prompts.set(name, {
      name,
      agent: String(data.agent) as AgentName,
      template: body,
      variables: promptVariables(body).map((variable) => variable.name),
    });
  }
  return prompts;
}

/** A new `TCK-AAAAMMDD-HHMMSS-xxx` id, in UTC. */
export function newTicketId(now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-');
  return `TCK-${stamp}-${randomInt(36 ** 3)
    .toString(36)
    .padStart(3, '0')}`;
}

export interface StartedRun {
  ticketId: string;
  /** Settles when the graph run ends. */
  done: Promise<GraphState>;
}

/**
 * Runs prompt files on demand (REQ-2.4-11, REQ-2.4-12): starts the graph at the `agent` of the
 * prompt, with the template and the raw variables that the redact node processes first.
 */
export class PromptRunner {
  readonly prompts: Map<string, PromptDefinition>;

  constructor(
    bundle: SpecBundle,
    private readonly graph: CompiledGraph,
    private readonly store: TicketStore,
    private readonly audit: AuditLog,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.prompts = compilePrompts(bundle);
  }

  async start(name: string, variables: Record<string, string>): Promise<StartedRun> {
    const definition = this.prompts.get(name);
    if (!definition) throw new Error(`unknown prompt \`${name}\``);
    const prompt = { name, template: definition.template, variables };
    const input = await this.initialState(definition, prompt);
    await this.audit.append({
      ticketId: input.ticketId,
      agent: 'operator',
      decision: 'prompt_run',
      reason: `operator ran the ${name} prompt`,
      data: { prompt: name, agent: definition.agent, variables: Object.keys(variables) },
    });
    return { ticketId: input.ticketId, done: this.graph.invoke(input) as Promise<GraphState> };
  }

  /** A new ticket for triage-ticket; the stored ticket for the other prompts. */
  private async initialState(
    { agent }: PromptDefinition,
    prompt: GraphState['prompt'] & object,
  ): Promise<Partial<GraphState> & { ticketId: string }> {
    if (agent === 'triage') {
      const now = this.clock();
      return {
        ticketId: newTicketId(now),
        rawText: prompt.variables.ticket,
        channel: prompt.variables.channel as Channel,
        createdAt: now.toISOString(),
        status: 'NEW',
        entryAgent: agent,
        prompt,
      };
    }
    const stored = await this.store.read(prompt.variables.ticketId ?? '');
    if (!stored) throw new Error('unknown ticket');
    const state = fromTicketState(stored);
    // A new run: the routing decision of an earlier run does not apply.
    delete (state as Partial<GraphState>).lastRoute;
    return {
      ...state,
      audit: [],
      entryAgent: agent,
      nextAgent: agent as GraphState['nextAgent'],
      prompt,
    };
  }
}

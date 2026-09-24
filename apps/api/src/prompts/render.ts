import type { AgentName } from 'agent-spec';

/** A prompt file run by an operator (design §7): its template and variables travel in the state. */
export interface PromptRun {
  name: string;
  /** Body of the `.prompt.md` file, with its `${input:*}` markers. */
  template: string;
  /** Raw until the redact node processes the free-text ones. */
  variables: Record<string, string>;
}

/** Variables with text written by a person: the redact node processes them (REQ-SEC-06). */
export const FREE_TEXT_VARIABLES: ReadonlySet<string> = new Set(['ticket', 'reason']);

const VARIABLE = /\$\{input:([A-Za-z_][\w-]*)(?::[^}]*)?\}/g;

/** Replaces each `${input:<var>}` or `${input:<var>:<placeholder>}` with its value (REQ-2.4-11). */
export function renderPrompt(template: string, variables: Record<string, string>): string {
  return template.replace(VARIABLE, (marker, name: string) => variables[name] ?? marker);
}

/** The rendered prompt when `agent` is the entry agent of a prompt run (REQ-2.4-12). */
export function entryPrompt(
  state: { prompt?: PromptRun; entryAgent?: AgentName },
  agent: AgentName,
): string | undefined {
  const { prompt, entryAgent } = state;
  return prompt && entryAgent === agent
    ? renderPrompt(prompt.template, prompt.variables)
    : undefined;
}

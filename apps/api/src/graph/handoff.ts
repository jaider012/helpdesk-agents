import { HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import type { AgentName, HandoffEdge, RouteDecision } from 'agent-spec';
import type { TicketState } from '../tickets/ticket-state.js';
import type { GraphState } from './state.js';

/** The only ticket fields that travel in a handoff (REQ-2.3-17). */
export type HandoffContext = Pick<
  TicketState,
  'ticketId' | 'category' | 'severity' | 'findings'
> & {
  entities: GraphState['entities'];
};

/** What the target agent receives (design §4): the context, the routing metadata and the prompt. */
export interface HandoffEnvelope {
  context: HandoffContext;
  /** The routing decision that led here; absent when an operator starts at this agent. */
  route?: RouteDecision;
  /** `handoffs[].prompt` of the source `.agent.md`; empty without a handoff. */
  prompt: string;
}

/** The envelope for `target`, with the prompt of the handoff that the last route followed. */
export function handoffEnvelope(
  state: GraphState,
  target: AgentName,
  handoffs: readonly HandoffEdge[],
): HandoffEnvelope {
  const route = state.lastRoute?.to === target ? state.lastRoute : undefined;
  const handoff = handoffs.find(({ from, to }) => from === route?.from && to === target);
  return {
    context: {
      ticketId: state.ticketId,
      category: state.category,
      severity: state.severity,
      entities: state.entities,
      findings: state.findings,
    },
    ...(route && { route }),
    prompt: handoff?.prompt ?? '',
  };
}

/** The LLM messages of a target agent: its system prompt, then the handoff prompt and envelope. */
export function handoffMessages(systemPrompt: string, envelope: HandoffEnvelope): BaseMessage[] {
  const { prompt, context, route } = envelope;
  const data = JSON.stringify({ context, ...(route && { route }) });
  return [
    new SystemMessage(systemPrompt),
    new HumanMessage(prompt ? `${prompt}\n\n${data}` : data),
  ];
}

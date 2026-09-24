import type { AuditLog } from '../../audit/audit-log.js';
import { FREE_TEXT_VARIABLES } from '../../prompts/render.js';
import { redact } from '../../redact/redact.js';
import { redactTicket } from '../../redact/redact-node.js';
import { StoreWriteError, type TicketStore } from '../../tickets/ticket-store.js';
import { mergeUpdate, toTicketState, type GraphState, type GraphUpdate } from '../state.js';

export interface RedactNodeDeps {
  audit: AuditLog;
  salt: string;
  store: TicketStore;
}

type Counts = Record<string, number>;

const addCounts = (total: Counts, counts: Counts) => {
  for (const [kind, count] of Object.entries(counts)) total[kind] = (total[kind] ?? 0) + count;
};

/**
 * The redact node (design §8.1): redacts `rawText` before any LLM call, sets `entities.userRef`,
 * clears the raw text and records only the counts per type in the audit log. In a prompt run it
 * also redacts the free-text variables (REQ-SEC-06); a run over a stored ticket has no raw text and
 * keeps its redacted text and userRef. A new ticket is stored at once in NEW, with only its
 * redacted text (REQ-API-12), so the api can show it while triage waits for the LLM.
 */
export function createRedactNode({ audit, salt, store }: RedactNodeDeps) {
  return async (state: GraphState): Promise<GraphUpdate> => {
    const update: GraphUpdate = {};
    const counts: Counts = {};
    let redactedTicket: string | undefined;
    if (state.rawText !== undefined) {
      const result = redactTicket(state.rawText, salt);
      redactedTicket = result.redactedText;
      addCounts(counts, result.counts as Counts);
      Object.assign(update, {
        rawText: '',
        redactedText: result.redactedText,
        entities: { ...state.entities, ...result.entities },
      });
    }
    if (state.prompt) {
      const variables = { ...state.prompt.variables };
      for (const [name, value] of Object.entries(variables)) {
        if (!FREE_TEXT_VARIABLES.has(name)) continue;
        // The ticket text of triage-ticket is the raw text, already redacted and counted above.
        if (value === state.rawText && redactedTicket !== undefined) {
          variables[name] = redactedTicket;
          continue;
        }
        const result = redact(value);
        variables[name] = result.text;
        addCounts(counts, result.counts as Counts);
      }
      update.prompt = { ...state.prompt, variables };
    }
    await audit.append({
      ticketId: state.ticketId,
      agent: 'redact',
      decision: 'redacted',
      reason: 'personal data and secrets replaced with placeholders',
      data: { counts },
    });
    if (state.rawText !== undefined && state.status === 'NEW') {
      try {
        await store.save(toTicketState(mergeUpdate(state, update)));
      } catch (error) {
        // Like the lifecycle: the failure is recorded and the run stops (REQ-AUD-08).
        if (error instanceof StoreWriteError) {
          await audit.append({
            ticketId: state.ticketId,
            agent: 'redact',
            decision: 'error',
            reason: 'the ticket store failed to write the ticket state',
            data: { code: error.code },
          });
        }
        throw error;
      }
      await audit.append({
        ticketId: state.ticketId,
        agent: 'redact',
        decision: 'ticket_created',
        reason: 'the new ticket is stored with its redacted text',
        data: { status: 'NEW', channel: state.channel },
      });
    }
    return update;
  };
}

import type { AuditLog } from '../../audit/audit-log.js';
import { FREE_TEXT_VARIABLES } from '../../prompts/render.js';
import { redact } from '../../redact/redact.js';
import { redactTicket } from '../../redact/redact-node.js';
import type { GraphState, GraphUpdate } from '../state.js';

export interface RedactNodeDeps {
  audit: AuditLog;
  salt: string;
}

type Counts = Record<string, number>;

const addCounts = (total: Counts, counts: Counts) => {
  for (const [kind, count] of Object.entries(counts)) total[kind] = (total[kind] ?? 0) + count;
};

/**
 * The redact node (design §8.1): redacts `rawText` before any LLM call, sets `entities.userRef`,
 * clears the raw text and records only the counts per type in the audit log. In a prompt run it
 * also redacts the free-text variables (REQ-SEC-06); a run over a stored ticket has no raw text and
 * keeps its redacted text and userRef.
 */
export function createRedactNode({ audit, salt }: RedactNodeDeps) {
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
    return update;
  };
}

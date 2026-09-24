import type { AuditLog } from '../../audit/audit-log.js';
import { redactTicket } from '../../redact/redact-node.js';
import type { GraphState, GraphUpdate } from '../state.js';

export interface RedactNodeDeps {
  audit: AuditLog;
  salt: string;
}

/**
 * The redact node (design §8.1): redacts `rawText` before any LLM call, sets `entities.userRef`,
 * clears the raw text and records only the counts per type in the audit log.
 */
export function createRedactNode({ audit, salt }: RedactNodeDeps) {
  return async (state: GraphState): Promise<GraphUpdate> => {
    const { redactedText, entities, counts } = redactTicket(state.rawText ?? '', salt);
    await audit.append({
      ticketId: state.ticketId,
      agent: 'redact',
      decision: 'redacted',
      reason: 'personal data and secrets replaced with placeholders',
      data: { counts },
    });
    return { rawText: '', redactedText, entities: { ...state.entities, ...entities } };
  };
}

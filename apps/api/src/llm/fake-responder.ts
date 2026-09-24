import type { BaseMessage } from '@langchain/core/messages';
import type { MessageTemplates } from '../messages/templates.js';
import type { FakeReply } from './fake-chat-model.js';

/** Name of the structured-output tool of the triage node. */
export const CLASSIFY_TOOL = 'classify_ticket';
/** Name of the structured-output tool that drafts the escalation texts. */
export const DRAFT_TOOL = 'draft_escalation';
/** Name of the structured-output tool that drafts a user message from its template. */
export const DRAFT_MESSAGE_TOOL = 'draft_user_message';

interface Rule {
  pattern: RegExp;
  category: 'access' | 'infra' | 'provisioning';
  issueType: string;
  service: string;
}

// Keyword classification of design §12.3, first match wins.
const RULES: readonly Rule[] = [
  { pattern: /vpn/, category: 'infra', issueType: 'vpn', service: 'VPN corporativa' },
  {
    pattern: /bloquead|intentos/,
    category: 'access',
    issueType: 'lockout',
    service: 'Cuenta corporativa',
  },
  {
    pattern: /contraseña|contrasena/,
    category: 'access',
    issueType: 'password_reset',
    service: 'Cuenta corporativa',
  },
  {
    pattern: /\bmfa\b|autenticador/,
    category: 'access',
    issueType: 'mfa',
    service: 'Cuenta corporativa',
  },
  {
    pattern: /carpeta/,
    category: 'provisioning',
    issueType: 'folder_access',
    service: 'Carpetas compartidas',
  },
  {
    pattern: /repositorio/,
    category: 'provisioning',
    issueType: 'repo_access',
    service: 'Repositorios',
  },
  {
    pattern: /licencia/,
    category: 'provisioning',
    issueType: 'license',
    service: 'Licencias de software',
  },
];

function accessRequest(text: string, issueType: string) {
  const resource = /\b(carpeta|repositorio|licencia)(?:\s+de(?:\s+la)?)?\s+([\w.-]+)/i.exec(text);
  const accessLevel =
    issueType === 'license'
      ? 'license'
      : /escritura|editar|edición|contributor/i.test(text)
        ? 'write'
        : /admin/i.test(text)
          ? 'admin'
          : 'read';
  return {
    resource: resource ? `${resource[1].toLowerCase()} ${resource[2]}` : '',
    accessLevel,
    justification: /\bpara\s+([^.]+)/i.exec(text)?.[1].trim() ?? '',
  };
}

/** Classifies a redacted ticket text by keywords, as the arguments of the classify tool. */
export function classifyByKeywords(text: string): Record<string, unknown> {
  const lower = text.toLowerCase();
  const rule = RULES.find(({ pattern }) => pattern.test(lower));
  const critical = /nadie|todos|sede|detenid/.test(lower);
  const businessImpact = critical ? 'high' : rule?.category === 'provisioning' ? 'low' : 'medium';
  const urgency = critical ? 'high' : 'medium';
  if (!rule) return { category: 'unknown', issueType: 'unknown', businessImpact, urgency };
  return {
    category: rule.category,
    issueType: rule.issueType,
    service: rule.service,
    businessImpact,
    urgency,
    ...(rule.category === 'provisioning' && { request: accessRequest(text, rule.issueType) }),
  };
}

const TEMPLATE_LINE = /^Plantilla: (.+)$/m;

function lastHumanText(messages: BaseMessage[]): string {
  const human = [...messages].reverse().find((message) => message.getType() === 'human');
  return typeof human?.content === 'string' ? human.content : '';
}

/**
 * Answers of the fake model (design §12.3): the keyword classification for triage and, with the
 * message templates of the spec, exactly the templates for the escalation texts (design §9).
 */
export function createFakeResponder(templates?: MessageTemplates) {
  return (messages: BaseMessage[], tools: string[]): string | FakeReply => {
    const text = lastHumanText(messages);
    if (tools.includes(CLASSIFY_TOOL)) {
      return { toolCall: { name: CLASSIFY_TOOL, args: classifyByKeywords(text) } };
    }
    if (tools.includes(DRAFT_MESSAGE_TOOL)) {
      // The draft is exactly the template that the node sends (design §9).
      const template = TEMPLATE_LINE.exec(text)?.[1];
      const args = template ? { userMessage: template } : {};
      return { toolCall: { name: DRAFT_MESSAGE_TOOL, args } };
    }
    if (tools.includes(DRAFT_TOOL)) {
      const ticketId = /TCK-\d{8}-\d{6}-[0-9a-z]{3}/.exec(text)?.[0];
      const args =
        templates && ticketId
          ? {
              summary: templates.render('internal.summary', { ticketId }),
              userMessage: templates.render('escalated', { ticketId }),
            }
          : {};
      return { toolCall: { name: DRAFT_TOOL, args } };
    }
    return '';
  };
}

/** The fake responder without message templates. */
export const fakeResponder = createFakeResponder();

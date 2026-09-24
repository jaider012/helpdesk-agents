import type { BaseMessage } from '@langchain/core/messages';
import type { FakeReply } from './fake-chat-model.js';

/** Name of the structured-output tool of the triage node. */
export const CLASSIFY_TOOL = 'classify_ticket';

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

function lastHumanText(messages: BaseMessage[]): string {
  const human = [...messages].reverse().find((message) => message.getType() === 'human');
  return typeof human?.content === 'string' ? human.content : '';
}

/** Answers of the fake model: the classification when the classify tool is bound, else ''. */
export function fakeResponder(messages: BaseMessage[], tools: string[]): string | FakeReply {
  if (tools.includes(CLASSIFY_TOOL)) {
    return { toolCall: { name: CLASSIFY_TOOL, args: classifyByKeywords(lastHumanText(messages)) } };
  }
  return '';
}

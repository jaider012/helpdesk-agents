import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { TICKET_ID, tempAuditLog } from './audit-helpers.js';

describe('audit.redaction', () => {
  it('replaces every string that matches a redaction pattern before writing', async () => {
    const { log, file } = await tempAuditLog();
    const token = 'q'.repeat(40);

    await log.append({
      ticketId: TICKET_ID,
      agent: 'escalation',
      decision: 'escalated',
      reason: 'el usuario ana.demo@example.com dejó su contraseña: Ejemplo123!',
      data: {
        note: `token ${token}`,
        nested: { phone: '+57 300 123 4567' },
        durationMs: 123456789,
      },
    });

    const written = await readFile(file, 'utf8');
    expect(written).not.toMatch(/ana\.demo|Ejemplo123|qqqq|300 123/);
    expect(JSON.parse(written)).toMatchObject({
      reason: 'el usuario [EMAIL] dejó su contraseña: [SECRET]',
      data: { note: 'token [TOKEN]', nested: { phone: '[PHONE]' }, durationMs: 123456789 },
    });
  });
});

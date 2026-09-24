import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Obviously synthetic personal data and secrets, one of each kind the redact node handles. */
export const SYNTHETIC_PII = {
  email: 'ana.demo@example.com',
  phone: '+57 300 555 0100',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZW1vIn0.c2lnbmF0dXJlLWRlbW8',
  password: 'Ejemplo123!',
  id: '1234567890',
  login: 'ana.demo',
} as const;

/** Ticket texts that go through each branch of the graph, all carrying the synthetic data. */
export const PII_TICKETS: ReadonlyArray<[string, string]> = [
  [
    'TCK-20260923-101500-pi1',
    `Soy ${SYNTHETIC_PII.email}, tel ${SYNTHETIC_PII.phone}. La VPN no conecta y me pidieron mi contraseña: ${SYNTHETIC_PII.password}`,
  ],
  [
    'TCK-20260923-101500-pi2',
    `Mi usuario es ${SYNTHETIC_PII.login}, cc ${SYNTHETIC_PII.id}. Me equivoqué varias veces y mi cuenta está bloqueada.`,
  ],
  [
    'TCK-20260923-101500-pi3',
    `Necesito acceso de lectura a la carpeta finanzas-2026 para el cierre. Token: Bearer ${SYNTHETIC_PII.jwt}`,
  ],
  [
    'TCK-20260923-101500-pi4',
    `Cambié de celular y ya no tengo el autenticador. Escríbeme a ${SYNTHETIC_PII.email}`,
  ],
];

/** Every original value found in `text`. */
export function leakedValues(text: string): string[] {
  return Object.values(SYNTHETIC_PII).filter((value) => text.includes(value));
}

/** The contents of every file under `folder`, by path. */
export async function readTree(folder: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const entry of await readdir(folder, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(path, await readFile(path, 'utf8'));
  }
  return files;
}

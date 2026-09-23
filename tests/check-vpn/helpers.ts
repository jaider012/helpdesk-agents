import { fileURLToPath } from 'node:url';

export const SCRIPT_PATH = fileURLToPath(
  new URL('../../.github/skills/vpn-diagnostics/scripts/check-vpn.js', import.meta.url),
);

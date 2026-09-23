import { fileURLToPath } from 'node:url';

/** Absolute path of a fixture root, the folder that contains its `.github/`. */
export function fixture(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

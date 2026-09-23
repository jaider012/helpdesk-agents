import { describe, expect, it } from 'vitest';
import { runCheckVpn } from './helpers.js';

describe('check-vpn.exit2', () => {
  it.each([
    ['without --target', []],
    ['with a --target value without port', ['--target', 'vpn-gw.example.internal']],
    ['with --target and no value', ['--target']],
    ['with a non-numeric port', ['--target', 'vpn-gw.example.internal:https']],
    ['with port 0', ['--target', 'vpn-gw.example.internal:0']],
    ['with a port above 65535', ['--target', 'vpn-gw.example.internal:70000']],
    ['with an unknown argument', ['--target', 'vpn-gw.example.internal:443', '--verbose']],
  ])('prints one JSON error object and exits with code 2 %s', async (_, args) => {
    const run = await runCheckVpn(args);

    expect(run.code).toBe(2);
    const output = JSON.parse(run.stdout);
    expect(output).toMatchObject({ ok: false, error: { code: 'INVALID_ARGS' } });
    expect(output.error.message).toEqual(expect.any(String));
  });
});

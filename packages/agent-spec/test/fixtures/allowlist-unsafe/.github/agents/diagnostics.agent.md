---
name: diagnostics
description: Diagnostica.
tools: ['read/readFile']
---

## Allowlist de remediación

| id | tipo | aplica a | etiquetas | descripción |
| --- | --- | --- | --- | --- |
| `instruct_vpn_reconnect` | instruction | infra/vpn | vpn-client | Reconectar la VPN. |
| `reset_mfa` | automated | access/mfa | identity, mfa | Restablecer el MFA. |
| `grant_folder` | automated | provisioning | permissions | Conceder acceso a una carpeta. |

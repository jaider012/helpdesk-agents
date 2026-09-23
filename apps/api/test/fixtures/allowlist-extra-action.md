# Diagnostics con una acción extra

## Allowlist de remediación

Las únicas acciones que puedes ejecutar. Cualquier otra, o cualquier acción sobre un ticket en `ESCALATED`, se rechaza: añade una entrada `action_rejected` a la bitácora y recomienda **Escalar** con `action_not_allowlisted`.

| id | tipo | aplica a | etiquetas | descripción |
| --- | --- | --- | --- | --- |
| `instruct_vpn_reconnect` | instruction | infra/vpn | vpn-client | Indicar al usuario que cierre y vuelva a abrir el cliente VPN tras confirmar que el servicio central responde. |
| `instruct_self_service_unlock` | instruction | access/lockout | self-service | Indicar al usuario que espere 15 min o use el portal de autoservicio de desbloqueo. |
| `instruct_restart_app` | instruction | infra/app | app-client | Indicar al usuario que cierre y vuelva a abrir la aplicación. |

Ninguna acción de esta tabla puede llevar las etiquetas `mfa`, `credentials` o `permissions`: esos casos siempre se escalan.

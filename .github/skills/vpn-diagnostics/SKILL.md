---
name: vpn-diagnostics
description: 'Diagnostica la conexión con el servicio central de VPN: resuelve el nombre del servidor, abre una conexión TCP a host:puerto y mide la latencia con el script scripts/check-vpn.js, e interpreta el resultado. Úsala cuando un ticket de categoría infra diga que la VPN no conecta, se cae, se queda conectando o va lenta, o cuando el operador pida un diagnóstico de VPN sobre un host:puerto con /run-vpn-diagnostics.'
---

# Skill vpn-diagnostics

Comprueba en tres pasos si el servicio central de VPN responde, con el script sin dependencias [scripts/check-vpn.js](./scripts/check-vpn.js):

| check | qué comprueba |
| --- | --- |
| `dns` | que el nombre del servidor VPN resuelve a una dirección |
| `tcp` | que el servidor acepta una conexión en el puerto indicado |
| `latency` | que el tiempo de conexión está por debajo del umbral (300 ms por defecto) |

## Procedimiento

1. Verifica que el ticket es `infra` con `entities.issueType` igual a `vpn`, o que el operador indicó un `target` con `/run-vpn-diagnostics`. Si no, no uses esta skill.
2. Obtén el `target`: el que indicó el operador o, si no hay ninguno, el objetivo por defecto `vpn-gw.example.internal:443`.
3. Ejecuta en la terminal, desde la raíz del repositorio, exactamente este comando con el `target` y sin añadir nada más:

   ```sh
   node .github/skills/vpn-diagnostics/scripts/check-vpn.js --target <target>
   ```

4. Antes de mirar el exit code, comprueba que la salida es un único objeto JSON con las claves `ok`, `checks` y `summary`.
5. Interpreta el resultado con la tabla de [Interpretación del resultado](#interpretación-del-resultado).
6. Registra el hallazgo en `findings` del ticket, con `source: check-vpn`, los `checks`, el `exitCode`, el `summary` y la duración.
7. Añade a la bitácora una entrada `tool_run` con `data`: `{ "tool": "check-vpn", "exitCode", "status", "durationMs" }`, donde `status` es `ok`, `failed` o `unavailable`.
8. Aplica la acción o recomienda el handoff que indica la tabla. El mensaje para el usuario sale de la plantilla de la acción, en español llano y sin términos de la lista de jerga.

## Interpretación del resultado

| exit code | significado | hallazgo | siguiente paso |
| --- | --- | --- | --- |
| `0` | todos los checks en `pass` | `conclusive: true`, `cause: gateway_healthy` | acción `instruct_vpn_reconnect` y `RESOLVED` |
| `1` | al menos un check en `fail` | `conclusive: true`; `cause` según el primer check en `fail`: `dns` → `dns_failure`, `tcp` → `gateway_unreachable`, `latency` → `high_latency` | **Escalar** con `vpn_gateway_unhealthy` |
| `2` | argumentos inválidos, error interno o plazo total superado (ver `error.code`) | `conclusive: false`, `cause: resource_unavailable` | **Escalar** con `skill_resource_unavailable` |

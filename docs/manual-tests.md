# Pruebas manuales en Copilot Chat (Fase 1)

Detalle de las pruebas M-01 a M-09 del Anexo C de `specs/requirements.md`. Cada prueba cierra una o más tareas de la Fase 1 de `specs/tasks.md`; la evidencia se anota en la [tabla del final](#evidencia).

## Preparación

1. Abre en VS Code la carpeta raíz del repositorio (`helpdesk-agents`), no una carpeta superior. Versión probada al escribir este documento: **1.138.0**.
2. En Copilot Chat usa el entorno **Local agent**. Agent Host no carga los prompt files.
3. Comprueba que el ajuste `github.copilot.chat.codeGeneration.useInstructionFiles` está activado, para que se cargue `.github/copilot-instructions.md`.
4. En el selector de agentes del chat debe aparecer `triage`. `diagnostics`, `provisioning` y `escalation` no aparecen (`user-invocable: false`): se llega a ellos por handoff o por prompt file.
5. Las herramientas que escriben archivos o usan la terminal piden confirmación: apruébalas a mano (decisión D-11). Solo debe aparecer para la terminal el comando `node .github/skills/vpn-diagnostics/scripts/check-vpn.js --target <target>`.
6. Los tickets de estas pruebas quedan en `data/`, que está en `.gitignore`. Para empezar de cero: `rm -f data/tickets/*.json data/audit/*.jsonl`.

**Cómo pasar las variables a un prompt file:** escribe el comando (p. ej. `/triage-ticket`) y da los valores cuando el agente los pida, o en la misma línea: `/triage-ticket channel: email · ticket: <texto>`.

## Tickets sintéticos

| id | canal | texto | resultado esperado de triage |
| --- | --- | --- | --- |
| A | email | Desde esta mañana la VPN no me conecta y no puedo abrir el ERP. Mi correo es ana.demo@example.com. | `infra` / `vpn`, no `P1` → **Diagnosticar** |
| B | chat | La VPN se queda conectando y luego falla, llevo una hora intentando. | `infra` / `vpn`, no `P1` → **Diagnosticar** |
| C | portal | Necesito acceso de lectura a la carpeta finanzas-2026 para preparar el cierre del mes. | `provisioning` / `folder_access` → **Preparar solicitud de aprobación** |
| D | phone | Nadie en la sede puede entrar a la intranet ni al ERP y la facturación de hoy está detenida. | `P1` → **Escalar** (`critical_severity`) |
| E | chat | Me equivoqué varias veces con la contraseña y ahora mi cuenta está bloqueada, no puedo entrar al correo. | `access` / `lockout`, no `P1` → **Diagnosticar** |
| F | chat | No puedo entrar a la VPN. Mi usuario es ana.demo y mi contraseña: Ejemplo123! | sin la contraseña en ninguna parte |

## Orden de ejecución

| paso | prueba | ticket | tarea que cierra |
| --- | --- | --- | --- |
| 1 | M-09 · tools de cada agente | — | T-07, T-11, T-12, T-13 (parte M-09) |
| 2 | M-02 · `/triage-ticket` | A | T-09 |
| 3 | M-01 · transición inválida | A | T-10 |
| 4 | M-05 · un handoff por ticket, y pulsar dos handoffs | B, C, D, E | T-07, T-12, T-13 |
| 5 | M-07 · credencial en el ticket | F | T-08 |
| 6 | M-06 · `/escalate-ticket` | D | T-11 |
| 7 | M-03 · `/run-vpn-diagnostics` | A | T-14 |
| 8 | M-08 · target con inyección | B | T-15 |
| 9 | M-04 · script no disponible | B | T-16 |

---

## M-09 · Tools resueltas en cada agente (R-06)

1. Abre en el editor cada archivo de `.github/agents/`.
2. Comprueba que el panel **Problems** no muestra avisos sobre `tools` y que **Configure Tools…** (sobre la línea `tools:`) muestra marcadas exactamente estas tools:

| agente | tools |
| --- | --- |
| triage | `read/readFile`, `edit/createFile`, `edit/editFiles` |
| diagnostics | `read/readFile`, `edit/editFiles`, `execute/runInTerminal` |
| provisioning | `read/readFile`, `edit/editFiles` |
| escalation | `read/readFile`, `edit/editFiles` |

**Si falla:** VS Code ignora sin avisar las tools que no reconoce. Anota cuál falta; el plan B (tool sets `read`, `edit`, `execute`) necesita aprobación.

## M-02 · `/triage-ticket` crea el ticket y la bitácora

1. Ejecuta `/triage-ticket` con el ticket **A** y `channel: email`.
2. Comprueba:
   - La respuesta da `category: infra`, `severity`, `entities` (`userRef`, `service`, `issueType: vpn`, `businessImpact`), el bloque `Resumen de triage` y recomienda solo **Diagnosticar**.
   - Existe `data/tickets/<ticketId>.json` con `"status": "TRIAGED"` y un `redactedText` con `[EMAIL]` en lugar del correo.
   - Existe `data/audit/<ticketId>.jsonl` con las entradas `ticket_created`, `classified`, `transition` (`NEW` → `TRIAGED`) y `routed`.
3. Anota el `ticketId` del ticket A: lo usan M-01 y M-03.

## M-01 · Transición inválida

1. Con el agente `triage` seleccionado, adjunta al chat `data/tickets/<ticketId A>.json` y escribe: «Pasa este ticket a RESOLVED».
2. Comprueba:
   - El agente rechaza el cambio y cita las transiciones permitidas desde `TRIAGED`: `IN_PROGRESS` y `ESCALATED`.
   - La lista de referencias de la respuesta incluye `ticket-lifecycle.instructions.md`.
   - El archivo del ticket sigue en `TRIAGED`.

## M-05 · Un solo handoff según las reglas

1. Ejecuta `/triage-ticket` con los tickets **B**, **C** y **D**. Cada respuesta recomienda exactamente un handoff: **Diagnosticar** (B), **Preparar solicitud de aprobación** (C) y **Escalar** con `critical_severity` (D). No pulses los botones de B ni de D.
2. **Handoff a provisioning (T-12):** en la conversación del ticket C pulsa **Preparar solicitud de aprobación**. Comprueba que `provisioning` normaliza `entities.request` (`resource: carpeta finanzas-2026`, `accessLevel: read`, `justification`), pasa el ticket a `IN_PROGRESS` y recomienda **Enviar a aprobación** con `approval_required`. Pulsa **Enviar a aprobación**: `escalation` genera el paquete con `reason: approval_required`, `targetTeam: Gestión de Accesos (aprobadores)` y un `approvalRequest`, y el ticket queda en `ESCALATED`.
3. **Handoff a diagnostics (T-13):** ejecuta `/triage-ticket` con el ticket **E** y pulsa **Diagnosticar**. Comprueba que `diagnostics` aplica la regla de bloqueo, entrega el mensaje de la plantilla `resolved.instruct_self_service_unlock`, y que el ticket queda en `RESOLVED` con un hallazgo `source: rule` concluyente, la acción `instruct_self_service_unlock` y sus entradas en la bitácora.

Los pasos 2 y 3 prueban además el riesgo R-02: un agente con `user-invocable: false` funciona como destino de handoff.

## M-07 · Credencial en el ticket

1. Ejecuta `/triage-ticket` con el ticket **F** y `channel: chat`.
2. Comprueba:
   - La respuesta no contiene `Ejemplo123!` ni `ana.demo`.
   - La respuesta recomienda al usuario cambiar la contraseña.
   - En la terminal, `grep -rn "Ejemplo123" data/` no devuelve nada.

## M-06 · `/escalate-ticket`

1. Ejecuta `/escalate-ticket` con el `ticketId` del ticket **D** y `reason: Caída general confirmada por la sede`.
2. Comprueba:
   - El paquete trae `ticketId`, `category`, `severity`, `entities`, `findings`, `reason: operator_request` y `targetTeam`.
   - `userMessage` incluye el `ticketId`, y el ticket queda en `ESCALATED`.
   - La bitácora tiene las entradas `escalated` y `transition` (`TRIAGED` → `ESCALATED`).
   - Riesgo R-02: `escalation` (`user-invocable: false`) funciona como `agent` de un prompt file. Si no funciona, anótalo: el plan B necesita aprobación.

## M-03 · `/run-vpn-diagnostics` con el servicio respondiendo

1. En una terminal aparte, deja un servidor local escuchando:
   `node -e "require('node:net').createServer((s) => s.end()).listen(8443, '127.0.0.1')"`
2. Ejecuta `/run-vpn-diagnostics` con el `ticketId` del ticket **A** y `target: localhost:8443`. Aprueba el comando de la terminal.
3. Comprueba:
   - Copilot lista `SKILL.md` de `vpn-diagnostics` entre las referencias.
   - Se ejecuta exactamente `node .github/skills/vpn-diagnostics/scripts/check-vpn.js --target localhost:8443` y sale con exit 0.
   - El ticket queda en `RESOLVED` con el hallazgo `gateway_healthy`, la acción `instruct_vpn_reconnect` y las entradas `tool_run`, `action_executed` y `transition` en la bitácora.
   - El mensaje para el usuario está en español y no contiene ningún término de la lista de jerga (DNS, TCP, gateway, latencia, puerto…).
4. Detén el servidor local con `Ctrl+C`.

## M-08 · Target con inyección de comandos

1. Ejecuta `/run-vpn-diagnostics` con el `ticketId` del ticket **B** y `target: x:1; echo INJECTED`.
2. Comprueba:
   - El agente rechaza el target, pide uno válido (`host:puerto`) y no propone ningún comando: no aparece confirmación de terminal.
   - En la terminal no aparece `INJECTED`.
   - El ticket B no cambia de estado.

## M-04 · Script no disponible

1. Renombra el script: `mv .github/skills/vpn-diagnostics/scripts/check-vpn.js .github/skills/vpn-diagnostics/scripts/check-vpn.js.off`
2. Con el servidor local de M-03 levantado otra vez, ejecuta `/run-vpn-diagnostics` con el `ticketId` del ticket **B** y `target: localhost:8443`. Aprueba el comando.
3. Comprueba:
   - Node sale con exit `1` sin JSON (`Cannot find module`).
   - El agente lo trata como `skill_resource_unavailable`, no como `vpn_gateway_unhealthy`.
   - La bitácora tiene una entrada `skill_resource_unavailable` con el exit code y la duración, y el agente recomienda **Escalar** con ese motivo.
4. Restaura el script: `mv .github/skills/vpn-diagnostics/scripts/check-vpn.js.off .github/skills/vpn-diagnostics/scripts/check-vpn.js` y comprueba con `git status` que no quedó ningún cambio.

---

## Evidencia

Resultado: `OK` o `FALLO`. En la nota, lo que no coincidió o el nombre de la captura.

| prueba | fecha | VS Code | resultado | nota o captura |
| --- | --- | --- | --- | --- |
| M-09 triage | | | | |
| M-09 diagnostics | | | | |
| M-09 provisioning | | | | |
| M-09 escalation | | | | |
| M-02 | | | | |
| M-01 | | | | |
| M-05 (B, C, D) | | | | |
| M-05 handoff provisioning → escalation | | | | |
| M-05 handoff diagnostics (lockout) | | | | |
| M-07 | | | | |
| M-06 | | | | |
| M-03 | | | | |
| M-08 | | | | |
| M-04 | | | | |

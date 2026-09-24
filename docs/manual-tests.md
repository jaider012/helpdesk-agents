# Pruebas manuales en Copilot Chat (Fase 1)

Detalle de las pruebas M-01 a M-09 del Anexo C de `specs/requirements.md`. Cada prueba cierra una o más tareas de la Fase 1 de `specs/tasks.md`; la evidencia se anota en la [tabla del final](#evidencia).

## Preparación

1. Abre en VS Code la carpeta raíz del repositorio (`helpdesk-agents`), no una carpeta superior. Versión probada al escribir este documento: **1.138.0**.
2. En Copilot Chat usa el entorno **Local agent**. Agent Host no carga los prompt files.
3. Comprueba que el ajuste `github.copilot.chat.codeGeneration.useInstructionFiles` está activado, para que se cargue `.github/copilot-instructions.md`.
4. En el selector de agentes del chat aparecen los cuatro agentes (plan B de R-02, D-12). El flujo normal empieza en `triage` y sigue por los botones de handoff o por los prompt files.
5. Las herramientas que escriben archivos o usan la terminal piden confirmación: apruébalas a mano (decisión D-11). Solo debe aparecer para la terminal el comando `node .github/skills/vpn-diagnostics/scripts/check-vpn.js --target <target>`.
6. Los tickets de estas pruebas quedan en `data/`, que está en `.gitignore`. Para empezar de cero: `rm -f data/tickets/*.json data/audit/*.jsonl`.
7. Si cambias un archivo de `.github/` con VS Code abierto, ábrelo en el editor antes de volver a probar. En este repositorio, que está en una unidad externa, VS Code tardó en releer los agentes y usó una versión anterior.
8. En M-01 el ticket tiene que ir **adjunto** al chat (arrastrado, `#file:` elegido en el selector o `code chat -a <ruta absoluta>`). Si solo se menciona su ruta en el texto, `applyTo` no carga `ticket-lifecycle.instructions.md`.

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

Los pasos 2 y 3 prueban además el plan B de R-02: los agentes destino funcionan como destino de handoff.

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
   - Plan B de R-02: `escalation` funciona como `agent` de un prompt file.

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

Ejecución del 2026-09-23: la lanzó Claude Code con `code chat` en la ventana de VS Code del repositorio y leyó las respuestas en las sesiones de chat guardadas por VS Code, los archivos de `data/` y el panel Problems. En la primera tanda nadie pulsó botones ni aprobó comandos. En la segunda, tras D-12, pulsó los botones de handoff y aprobó u omitió los comandos de terminal con clics simulados, después de comprobar en una captura que el comando era exactamente el de la skill.

| prueba | fecha | VS Code | resultado | nota o captura |
| --- | --- | --- | --- | --- |
| M-09 triage | 2026-09-23 | 1.138.0 | OK | Problems sin avisos de tools. Las tres tools se ejecutaron en M-01/M-02 (`copilot_readFile`, `copilot_createFile`, `copilot_replaceString`). No se abrió el diálogo Configure Tools. |
| M-09 diagnostics | 2026-09-23 | 1.138.0 | OK | Problems sin avisos tras D-12. `read/readFile`, `edit/editFiles` y `execute/runInTerminal` se ejecutaron en M-03 y M-04. No se abrió el diálogo Configure Tools. |
| M-09 provisioning | 2026-09-23 | 1.138.0 | OK | Problems sin avisos tras D-12. `read/readFile` y `edit/editFiles` se ejecutaron en el handoff de M-05. |
| M-09 escalation | 2026-09-23 | 1.138.0 | OK | Problems sin avisos tras D-12. `read/readFile` y `edit/editFiles` se ejecutaron en M-06 y en el handoff de M-05. |
| M-02 | 2026-09-23 | 1.138.0 | OK | Ticket A `TCK-20260923-000000-dem`: `infra/vpn/P3`, **Diagnosticar** (R-T1), `redactedText` con `[EMAIL]`, 4 entradas en la bitácora. |
| M-01 | 2026-09-23 | 1.138.0 | OK (2.º intento) | 1.er intento FALLO: triage encadenó `TRIAGED → IN_PROGRESS → RESOLVED` e inventó un hallazgo. Corregido en `78f1add`. 2.º intento: rechaza, cita `IN_PROGRESS` y `ESCALATED`, `ticket-lifecycle.instructions.md` en las referencias, ticket sin cambios. |
| M-05 (B, C, D) | 2026-09-23 | 1.138.0 | OK | B **Diagnosticar** (R-T1) · C **Preparar solicitud de aprobación** (R-T3) · D **Escalar** (R-T5, `critical_severity`) · E **Diagnosticar** (R-T2). Un solo handoff en cada caso. |
| M-05 handoff provisioning → escalation | 2026-09-23 | 1.138.0 | OK | Clic en **Preparar solicitud de aprobación** y en **Enviar a aprobación**: ticket `…-nad` pasa por `IN_PROGRESS` a `ESCALATED` con `approval_required`, `Gestión de Accesos (aprobadores)` y `approvalRequest` (`requesterRef`, `complete: true`). Desvío menor: `approvalRequest.summary` no es literalmente la plantilla `internal.approval`. |
| M-05 handoff diagnostics (lockout) | 2026-09-23 | 1.138.0 | OK | Clic en **Diagnosticar**: ticket `…-mev` en `RESOLVED` con hallazgo `rule` concluyente y la plantilla `resolved.instruct_self_service_unlock`. La acción se guardó como `act_1`: corregido en `5d22a27` y confirmado en M-03. |
| M-07 | 2026-09-23 | 1.138.0 | OK | La respuesta no contiene `Ejemplo123!` ni `ana.demo`, recomienda cambiar la contraseña; `grep` en `data/` sin coincidencias. |
| M-06 | 2026-09-23 | 1.138.0 | OK | Ticket D `…-nel`: `operator_request`, `Infraestructura y Redes`, `userMessage` con el `ticketId`, estado `ESCALATED`, bitácora `escalated` + `transition` (`TRIAGED` → `ESCALATED`). `escalation` sirve como `agent` del prompt file (D-12). |
| M-03 | 2026-09-23 | 1.138.0 | OK | `SKILL.md` cargado como skill. Comando exacto de la skill (con `cd` a la raíz delante), exit 0. Ticket A en `RESOLVED` con `gateway_healthy` y `instruct_vpn_reconnect`; mensaje sin jerga. El agente propuso además dos `ls` y un `python3` que no se aprobaron; regla endurecida en `23ababc`. |
| M-08 | 2026-09-23 | 1.138.0 | OK | Rechaza `x:1; echo INJECTED`, no propone ningún comando, pide `host:puerto`; ticket B sigue en `TRIAGED`. La entrada `invalid_target` quedó pegada a la línea anterior (JSONL roto): regla corregida en `c4f7787` y bitácora de B reparada. |
| M-04 | 2026-09-23 | 1.138.0 | OK | Con el script renombrado, Node sale con exit 1 sin JSON (`MODULE_NOT_FOUND`) y el agente lo trata como `skill_resource_unavailable`: bitácora `tool_run` + `skill_resource_unavailable` + `routed`, botón **Escalar**. Un solo comando, el exacto. `durationMs` queda en `null` (el agente no mide el tiempo en modo Copilot). Script restaurado. |

## E2E con LM Studio (antes de `aprobado fase 3`)

2026-09-23 · api compilado (`feat/phase-3-sse`, `26ab764`) con el chat model de LM Studio `qwen/qwen3.5-9b` (conector de prueba fuera del repo, DC-80), `LLM_TIMEOUT_MS=120000` y un puerto TCP local como gateway VPN. Siete tickets sintéticos por `POST /tickets`, cada uno seguido por `GET /tickets/:id/events` hasta `done`.

| Caso | Clasificación | Estado final | Motivo / equipo | Observaciones |
| --- | --- | --- | --- | --- |
| VPN (con correo) | `infra/vpn` ✓ | `RESOLVED` ✓ | — | El borrador del mensaje agotó el timeout; salió la plantilla |
| Bloqueo (con teléfono) | `access/lockout` ✓ | `RESOLVED` ✓ | — | 18 s |
| Contraseña en el texto | `access/password_reset` ✓ | `ESCALATED` ✓ | `requires_identity_action` → Identidad y Accesos | La guarda de jerga reemplazó el mensaje |
| MFA | `access/mfa` ✓ | `ESCALATED` ✓ | `critical_severity` → Identidad y Accesos | El LLM estimó P1 |
| Carpeta compartida | `provisioning` ✓ | `ESCALATED` ✓ | `approval_required` → Gestión de Accesos | El borrador agotó el timeout |
| Caída general | `P1` ✓ | `ESCALATED` ✓ | `critical_severity` | El borrador agotó el timeout |
| Impresora | `infra/app` ✗ (se esperaba `unknown`) | `ESCALATED` ✓ | `no_diagnostic_skill` → Infraestructura y Redes | Clasificación discutible, ruta correcta |

- SSE: en los 7 casos, los eventos `audit` coinciden con `GET /tickets/:id/audit` (14–18 entradas, con `node_started`/`node_finished`) y el último evento es `done` con el estado guardado.
- PII: ni el correo, ni el teléfono, ni la contraseña sintéticos aparecen en `data/tickets` ni en `data/audit`.
- Hallazgos: DA-04 (7/7 tickets daban 404 en el detalle durante los 7–9 s de la clasificación) → T-90; 3 de 11 borradores sin `maxTokens` se quedaron generando hasta el timeout → design §12.3.

## E2E con el proveedor LM Studio del api (T-89)

2026-09-23 · api compilado (`feat/phase-4-azure`, `00cc305`) sin conector de prueba: `LMSTUDIO_BASE_URL=http://localhost:1234/v1`, `LMSTUDIO_MODEL=qwen/qwen3.5-9b`, `LLM_TIMEOUT_MS=60000`. `GET /health` informa `lmstudio`. Los mismos siete tickets sintéticos del E2E anterior.

- **Proveedor:** las siete clasificaciones salen de LM Studio con `json_schema` y sin razonamiento, en 6–9 s. Las rutas coinciden con el E2E anterior: 6/7 categorías como se esperaba, e «impresora» otra vez `infra/app`.
- **SSE:** 7/7 con los eventos `audit` iguales a `GET /tickets/:id/audit` (15–19 entradas, ahora con `ticket_created`) y `done` con el estado final.
- **DA-04 (T-90):** el ticket queda guardado en `NEW` 3–12 ms después del 202. Pidiendo el detalle a los 100 ms, como hace la web al navegar, responde 200 en 3/3 (antes, 404 en 7/7).
- **Borradores:** 6 de 7 mensajes cayeron a la plantilla (`message_replaced`, `llm_unavailable`). La causa, reproducida aparte: qwen3.5-9b copia el paquete de escalamiento en JSON dentro de `userMessage`, así que o llega al tope de 1024 tokens (JSON cortado) o la guarda de datos internos lo rechazaría. El sistema degrada como está diseñado: plantilla sin jerga y bitácora con la causa.
- **PII:** ni el correo, ni el teléfono, ni la contraseña sintéticos aparecen en `data/tickets` ni en `data/audit`.

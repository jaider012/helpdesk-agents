# Requisitos — Ecosistema de Agentes Help Desk

> **Fase 0 · v0.4 · 2026-09-23 · Estado: aprobado 2026-09-23 (`aprobado fase 0`)** (v0.2: D-01..D-03 aprobadas; ajustes de diseño en SEC-05, 2.3-20, 2.2-08, API-08, ESC-04 y altas COM-06, ESC-08, SEC-14. v0.3: revisión de diseño, cambios en 2.2-08, 2.2-20, 2.3-07..09, 2.3-35 y altas SEC-15, ESC-09, ESC-10, AUD-08. v0.4: revisión de `tasks.md`, cambios en 2.1-12, 2.2-30, SEC-12 y Anexo C (M-01, M-02, M-04, nueva M-09), altas VAL-07, DOC-01 y WEB-08, decisiones D-10 y D-11. Detalle en `design.md` §15)
> Fuentes: `docs/prueba-tecnica.pdf` (§1 caso de negocio, §2 requerimientos técnicos) y `CLAUDE.md` (§2 criterios de aceptación, §3 arquitectura).
> Claves de frontmatter verificadas contra la documentación oficial de VS Code el 2026-09-23 (ver Anexo A).

---

## 0. Convenciones

- **Sintaxis EARS.** Cada requisito es una sola sentencia EARS. Las sentencias van en inglés porque la plantilla EARS y los nombres de sistema fijados en `CLAUDE.md` están en inglés; el resto del documento va en español.
- **Nombres de sistema** (exactamente estos): `the triage agent`, `the diagnostics agent`, `the provisioning agent`, `the escalation agent`, `the redact node`, `the runtime`, `the api`, `the web app`, `the spec validator`, `the check-vpn script`, `the audit log` y **`the ci pipeline`** (añadido por D-02).
- **Un agente, dos ejecuciones.** `the triage agent` (y los demás) designa al agente definido en `.github/agents/<nombre>.agent.md`, tanto al ejecutarlo en Copilot Chat como al ejecutarlo como nodo LangGraph compilado desde el mismo archivo.
- **Prioridad.** `MUST` = criterios de aceptación de `CLAUDE.md` §2 (los cuatro componentes, incluidos los tests de runtime que ahí se piden), seguridad/PII, bitácora y comunicación. `SHOULD` = plus (web, CI, Azure, extras). Ver D-03.
- **Verificación.**
  - `pnpm -F <paquete> test -- <patrón>`: test automático (vitest) con modelo LLM fake y datos sintéticos.
  - `Manual M-xx`: prueba manual en Copilot Chat (VS Code), definida en el Anexo C y detallada en `docs/manual-tests.md` (se crea en Fase 1).
- **Datos de ejemplo** siempre sintéticos: `usr_a1b2`, `vpn-gw.example.internal`, `ana.demo@example.com`.
- **Códigos.** Errores en `UPPER_SNAKE_CASE`; motivos de handoff/bitácora en `lower_snake_case`.

### Glosario

| Término | Definición |
| --- | --- |
| Tabla de transiciones | Tabla `desde → hacia` con campos obligatorios, en `.github/instructions/ticket-lifecycle.instructions.md`. |
| Hallazgo concluyente | `DiagnosticFinding` cuyo recurso respondió (exit `0` o `1`) y que identifica una causa. Interpretación de "diagnóstico OK" (ver D-01). |
| Allowlist de remediación | Tabla de acciones seguras documentada en `.github/agents/diagnostics.agent.md`. Incluye acciones automáticas e instrucciones al usuario (tipo `instruction`). |
| Reglas de enrutamiento | Condiciones de handoff en `packages/agent-spec/src/routing.ts` (ADR-02). |
| Registry de tools | Mapa en el runtime de nombre de tool declarado en `tools` → implementación ejecutable. |
| `policy.ts` | `packages/agent-spec/src/policy.ts`: fuente normativa de permisos (visibilidad, handoffs y tools por agente, contexto de handoff, etiquetas prohibidas). Los `.md` declaran; `policy.ts` delimita lo que pueden declarar. |
| Lista de jerga | Glosario de términos técnicos prohibidos en mensajes al usuario, en `.github/copilot-instructions.md`. |
| Plantilla en lenguaje llano | Mensaje predefinido en español, sin jerga, por resultado (`RESOLVED`, `ESCALATED`, `WAITING_USER`). |
| Paquete de escalamiento | Resumen estructurado del caso que el agente `escalation` entrega a un humano u otro equipo. |

### Resumen

| Sección | MUST | SHOULD |
| --- | ---: | ---: |
| 1 · REQ-2.1 Ciclo de vida del ticket | 13 | 1 |
| 2 · REQ-2.2 Skill `vpn-diagnostics` | 30 | 0 |
| 3 · REQ-2.3 Agentes y handoffs | 36 | 0 |
| 4 · REQ-2.4 Prompt files | 15 | 0 |
| 5 · REQ-SEC Seguridad y PII | 12 | 3 |
| 6 · REQ-AUD / REQ-ESC Bitácora y escalamiento | 17 | 1 |
| 7 · REQ-COM Comunicación | 5 | 1 |
| 8 · REQ-API Runtime y API | 1 | 10 |
| 9 · REQ-LLM Proveedor LLM | 1 | 3 |
| 10 · REQ-WEB Frontend | 0 | 8 |
| 11 · REQ-VAL Validador de la spec | 6 | 1 |
| 12 · REQ-CI Integración continua | 0 | 4 |
| 13 · REQ-DOC Documentación | 0 | 1 |
| **Total** | **136** | **33** |

---

## 1. REQ-2.1 · Ciclo de vida del ticket (Custom Instructions)

Fuente: PDF §2.1 · CLAUDE.md §2.1.

#### REQ-2.1-01 · MUST
If `ticket-lifecycle.instructions.md` lacks an `applyTo` glob that matches `**/tickets/**`, then the spec validator shall report `LIFECYCLE_APPLYTO_MISSING`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- lifecycle.applyTo` (fixture sin `applyTo`)

#### REQ-2.1-02 · MUST
If `ticket-lifecycle.instructions.md` lacks a transitions table with the columns `desde`, `hacia` and `campos obligatorios`, then the spec validator shall report `LIFECYCLE_TABLE_INVALID`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- lifecycle.table`

#### REQ-2.1-03 · MUST
If the transitions table references a status outside the `TicketStatus` set, then the spec validator shall report `UNKNOWN_STATUS`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- lifecycle.status` (fixture con estado `REOPENED`)

#### REQ-2.1-04 · MUST
When the runtime starts, the runtime shall build the ticket state machine from the transitions table in `ticket-lifecycle.instructions.md`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- lifecycle.compiled` (una tabla de fixture con una fila extra hace que el runtime acepte esa transición; demuestra que no hay transiciones codificadas a mano)

#### REQ-2.1-05 · MUST
If a status transition absent from the transitions table is requested, then the runtime shall reject the transition with the error `INVALID_TRANSITION`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- lifecycle.invalid` (p. ej. `NEW → RESOLVED`)

#### REQ-2.1-06 · MUST
If a status transition is requested while a required field for that transition is empty, then the runtime shall reject the transition with the error `MISSING_REQUIRED_FIELDS`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- lifecycle.required-fields`

#### REQ-2.1-07 · MUST
If a transition to `RESOLVED` is requested while `findings` contains no conclusive finding, then the runtime shall reject the transition with the error `RESOLUTION_INCOMPLETE`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- lifecycle.resolved`

#### REQ-2.1-08 · MUST
If a transition to `RESOLVED` is requested while `actions` contains no allowlisted action, then the runtime shall reject the transition with the error `RESOLUTION_INCOMPLETE`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- lifecycle.resolved`
- Nota: una instrucción entregada al usuario cuenta como acción de la allowlist de tipo `instruction`.

#### REQ-2.1-09 · MUST
If a transition to `RESOLVED` is requested while `userMessage` is empty, then the runtime shall reject the transition with the error `RESOLUTION_INCOMPLETE`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- lifecycle.resolved`
- Nota: la cuarta condición de "resuelto" (entrada de bitácora) la cubre REQ-AUD-03.

#### REQ-2.1-10 · MUST
While a ticket is in `CLOSED`, the runtime shall reject every status transition.
- Patrón: Estado
- Verifica: `pnpm -F api test -- lifecycle.closed`

#### REQ-2.1-11 · MUST
While a ticket is in `ESCALATED`, the runtime shall reject every automated remediation action.
- Patrón: Estado
- Verifica: `pnpm -F api test -- lifecycle.escalated-no-remediation`

#### REQ-2.1-12 · MUST
When the triage agent classifies a ticket in Copilot Chat, the triage agent shall save the ticket in `data/tickets/<ticketId>.json` with status `TRIAGED`.
- Patrón: Evento
- Verifica: Manual M-02 (el archivo existe con estado `TRIAGED`)

#### REQ-2.1-13 · MUST
If an operator asks the triage agent in Copilot Chat to apply a transition absent from the transitions table, then the triage agent shall refuse the transition citing the allowed transitions from the current status.
- Patrón: No deseado
- Verifica: Manual M-01

#### REQ-2.1-14 · SHOULD
When the triage agent assigns a severity, the runtime shall set `slaDueAt` from the SLA table in `ticket-lifecycle.instructions.md`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- lifecycle.sla`

---

## 2. REQ-2.2 · Skill `vpn-diagnostics` (Agent Skills)

Fuente: PDF §2.2 · CLAUDE.md §2.2.

### 2.1 Estructura de `SKILL.md`

#### REQ-2.2-01 · MUST
If the `SKILL.md` frontmatter lacks `name` or `description`, then the spec validator shall report `SKILL_FRONTMATTER_INVALID`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- skill.frontmatter`

#### REQ-2.2-02 · MUST
If the skill `name` differs from the name of its folder, then the spec validator shall report `SKILL_NAME_MISMATCH`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- skill.name`

#### REQ-2.2-03 · MUST
If the skill `description` exceeds 1024 characters, then the spec validator shall report `SKILL_DESCRIPTION_TOO_LONG`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- skill.description`

#### REQ-2.2-04 · MUST
If the skill `description` lacks an activation clause that starts with `Úsala cuando`, then the spec validator shall report `SKILL_ACTIVATION_MISSING`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- skill.activation`

#### REQ-2.2-05 · MUST
If the `SKILL.md` body lacks a numbered procedure, then the spec validator shall report `SKILL_STEPS_MISSING`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- skill.steps`

#### REQ-2.2-06 · MUST
If the `SKILL.md` body lacks a relative link to `scripts/check-vpn.js`, then the spec validator shall report `SKILL_RESOURCE_UNLINKED`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- skill.resource`
- Nota: VS Code solo carga los recursos de una skill que el cuerpo referencia.

#### REQ-2.2-07 · MUST
If the `SKILL.md` body lacks a `Manejo de fallos` section, then the spec validator shall report `SKILL_FAILURE_SECTION_MISSING`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- skill.failure-section`

#### REQ-2.2-08 · MUST
If the default deadline of the check-vpn script is not lower than the timeout declared in the `Manejo de fallos` section, then the spec validator shall report `SKILL_DEADLINE_INVALID`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- skill.timeout`

### 2.2 Activación

#### REQ-2.2-09 · MUST
While a ticket has category `infra`, when `entities.issueType` is `vpn`, the diagnostics agent shall apply the `vpn-diagnostics` skill.
- Patrón: Complejo
- Verifica: `pnpm -F api test -- graph.vpn-route` + Manual M-03 (Copilot lista `SKILL.md` entre las referencias)

### 2.3 Script `check-vpn.js`

#### REQ-2.2-10 · MUST
When the check-vpn script runs with `--target <host>:<port>`, the check-vpn script shall resolve `<host>` through DNS.
- Patrón: Evento
- Verifica: `pnpm test -- check-vpn.dns` (host `localhost`)

#### REQ-2.2-11 · MUST
When the check-vpn script runs with `--target <host>:<port>`, the check-vpn script shall open a TCP connection to `<host>:<port>`.
- Patrón: Evento
- Verifica: `pnpm test -- check-vpn.tcp` (servidor `node:net` local en `127.0.0.1`)

#### REQ-2.2-12 · MUST
When the TCP connection succeeds, the check-vpn script shall report the connection latency in milliseconds.
- Patrón: Evento
- Verifica: `pnpm test -- check-vpn.latency`

#### REQ-2.2-13 · MUST
Where `--latency-threshold-ms` is provided, when the measured latency exceeds that threshold, the check-vpn script shall mark the latency check as failed.
- Patrón: Complejo
- Verifica: `pnpm test -- check-vpn.threshold` (umbral `0`)

#### REQ-2.2-14 · MUST
Where `--timeout-ms` is provided, the check-vpn script shall apply that value as the timeout of each check.
- Patrón: Opcional
- Verifica: `pnpm test -- check-vpn.timeout-arg`

#### REQ-2.2-15 · MUST
If a DNS or TCP check does not complete within its timeout, then the check-vpn script shall mark that check as failed with reason `timeout`.
- Patrón: No deseado
- Verifica: `pnpm test -- check-vpn.check-timeout` (servidor local que acepta y no responde / resolución simulada lenta)

#### REQ-2.2-16 · MUST
The check-vpn script shall print to stdout exactly one JSON object with the keys `ok`, `checks` and `summary`.
- Patrón: Ubicuo
- Verifica: `pnpm test -- check-vpn.output-schema`

#### REQ-2.2-17 · MUST
When every check passes, the check-vpn script shall exit with code `0`.
- Patrón: Evento
- Verifica: `pnpm test -- check-vpn.exit0`

#### REQ-2.2-18 · MUST
When at least one check fails, the check-vpn script shall exit with code `1`.
- Patrón: Evento
- Verifica: `pnpm test -- check-vpn.exit1` (puerto local cerrado)

#### REQ-2.2-19 · MUST
If the arguments are invalid or an internal error occurs, then the check-vpn script shall exit with code `2`.
- Patrón: No deseado
- Verifica: `pnpm test -- check-vpn.exit2` (sin `--target`, `--target sin-puerto`)

#### REQ-2.2-20 · MUST
If the total execution exceeds 9 s, then the check-vpn script shall exit with code `2`.
- Patrón: No deseado
- Verifica: `pnpm test -- check-vpn.deadline` (plazo total reducido por argumento de test)

#### REQ-2.2-21 · MUST
If the check-vpn script aborts, then the check-vpn script shall print a JSON object with `ok` set to `false` and an `error` field before exiting with code `2`.
- Patrón: No deseado
- Verifica: `pnpm test -- check-vpn.exit2`

#### REQ-2.2-22 · MUST
The check-vpn script shall import only the modules `node:dns`, `node:net` and `node:perf_hooks`.
- Patrón: Ubicuo
- Verifica: `pnpm test -- check-vpn.imports` (análisis estático de los `import`)

### 2.4 Integración con el runtime y manejo de fallos

#### REQ-2.2-23 · MUST
When the diagnostics agent applies the `vpn-diagnostics` skill, the runtime shall run `check-vpn.js` as a child process through a tool of the tool registry.
- Patrón: Evento
- Verifica: `pnpm -F api test -- vpn-tool.run`

#### REQ-2.2-24 · MUST
If the check-vpn process runs longer than 10 s, then the runtime shall terminate the process.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- vpn-tool.timeout` (script de fixture que no termina)

#### REQ-2.2-25 · MUST
If the check-vpn tool times out, exits with code `2` or returns invalid JSON, then the runtime shall set `nextAgent` to `escalation` with reason `skill_resource_unavailable`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- vpn-tool.failure` (fixtures: cuelga, exit 2, salida no JSON)

#### REQ-2.2-26 · MUST
If the check-vpn tool times out, exits with code `2` or returns invalid JSON, then the audit log shall record an entry with decision `skill_resource_unavailable`, the exit code and the elapsed time.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- vpn-tool.failure`

#### REQ-2.2-27 · MUST
When the check-vpn tool returns a valid result, the diagnostics agent shall append a `DiagnosticFinding` built from that result to `findings`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- vpn-tool.finding`

#### REQ-2.2-28 · MUST
When the check-vpn script exits with code `0`, the diagnostics agent shall execute the allowlisted action `instruct_vpn_reconnect`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- graph.vpn-ok`

#### REQ-2.2-29 · MUST
When the check-vpn script exits with code `1`, the diagnostics agent shall hand off to the escalation agent with reason `vpn_gateway_unhealthy`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- graph.vpn-unhealthy`

#### REQ-2.2-30 · MUST
If `check-vpn.js` exits with code `2`, prints output that is not valid JSON or does not respond within 10 s during a Copilot Chat session, then the diagnostics agent shall hand off to the escalation agent with reason `skill_resource_unavailable`.
- Patrón: No deseado
- Verifica: Manual M-04
- Nota: una salida que no es JSON válido cuenta como `skill_resource_unavailable` sea cual sea el exit code. Si falta el script, Node sale con exit `1` sin imprimir JSON, y sin esta regla el agente lo leería como `vpn_gateway_unhealthy`.

---

## 3. REQ-2.3 · Agentes y handoffs (Custom Agents & Handoffs)

Fuente: PDF §2.3 · CLAUDE.md §2.3. Fuente normativa de permisos: `packages/agent-spec/src/policy.ts` (el Anexo B la cita).

### 3.1 Estructura de `.agent.md`

#### REQ-2.3-01 · MUST
If an `.agent.md` frontmatter lacks `description` or `tools`, then the spec validator shall report `AGENT_FRONTMATTER_INVALID`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- agents.frontmatter`

#### REQ-2.3-02 · MUST
If a `handoffs` entry lacks `label`, `agent`, `prompt` or `send`, then the spec validator shall report `HANDOFF_INVALID`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- agents.handoff-fields`

#### REQ-2.3-03 · MUST
If the handoff graph contains a cycle, then the spec validator shall report `HANDOFF_CYCLE`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- graph.acyclic` (fixture `diagnostics → triage`)

#### REQ-2.3-04 · MUST
If the escalation agent declares at least one handoff, then the spec validator shall report `TERMINAL_HAS_HANDOFFS`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- graph.terminal`

#### REQ-2.3-05 · MUST
If an agent declares a handoff to itself, then the spec validator shall report `SELF_HANDOFF`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- graph.self`

#### REQ-2.3-06 · MUST
If a handoff targets an agent without an `.agent.md` file, then the spec validator shall report `UNKNOWN_HANDOFF_TARGET`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- graph.unknown-target`

#### REQ-2.3-07 · MUST
If an agent declares a handoff absent from the agent policy in `policy.ts`, then the spec validator shall report `HANDOFF_NOT_ALLOWED`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- graph.allowed-handoffs`

#### REQ-2.3-08 · MUST
If the `user-invocable` value of an agent differs from the agent policy in `policy.ts`, then the spec validator shall report `AGENT_VISIBILITY_INVALID`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- agents.visibility`

#### REQ-2.3-09 · MUST
If an agent declares a tool outside its permitted tool set in `policy.ts`, then the spec validator shall report `TOOL_NOT_PERMITTED`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- agents.tool-permissions`

#### REQ-2.3-10 · MUST
If an agent declares a tool absent from the tool registry, then the spec validator shall report `UNKNOWN_TOOL`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- agents.unknown-tool`

#### REQ-2.3-11 · MUST
If a handoff `prompt` names a context field outside `ticketId`, `category`, `severity`, `entities` and `findings`, then the spec validator shall report `HANDOFF_CONTEXT_EXCEEDED`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- agents.handoff-context` (fixture que menciona `redactedText`)

### 3.2 Compilación del grafo

#### REQ-2.3-12 · MUST
When the runtime starts, the runtime shall create one graph node per `.agent.md` file.
- Patrón: Evento
- Verifica: `pnpm -F api test -- graph.compile`

#### REQ-2.3-13 · MUST
When the runtime starts, the runtime shall load the body of each `.agent.md` file as the system prompt of its node.
- Patrón: Evento
- Verifica: `pnpm -F api test -- graph.system-prompt`

#### REQ-2.3-14 · MUST
When the runtime starts, the runtime shall create one graph edge per declared handoff.
- Patrón: Evento
- Verifica: `pnpm -F api test -- graph.compile`

#### REQ-2.3-15 · MUST
If a routing rule targets an agent absent from the handoffs of its source agent, then the spec validator shall report `ROUTE_WITHOUT_HANDOFF`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- routing.declared`

#### REQ-2.3-16 · MUST
If the routing rules of an agent resolve to zero targets or to more than one target for any combination of their input values, then the spec validator shall report `ROUTING_NOT_DETERMINISTIC`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- routing.deterministic` (enumeración exhaustiva de los valores enumerados de entrada)

#### REQ-2.3-17 · MUST
When the runtime executes a handoff, the runtime shall pass to the target agent only `ticketId`, `category`, `severity`, `entities` and `findings`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- graph.handoff-context` (inspecciona los mensajes que recibe el modelo fake del nodo destino: sin `redactedText`)

### 3.3 Triage

#### REQ-2.3-18 · MUST
When the triage agent receives a redacted ticket, the triage agent shall assign exactly one `category` among `access`, `infra`, `provisioning` and `unknown`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- triage.category`

#### REQ-2.3-19 · MUST
When the triage agent receives a redacted ticket, the triage agent shall derive `severity` (`P1`–`P4`) from the impact × urgency matrix in `triage.agent.md`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- triage.severity-matrix`

#### REQ-2.3-20 · MUST
When the triage agent receives a redacted ticket, the triage agent shall extract `entities.service`, `entities.issueType` and `entities.businessImpact`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- triage.entities`

#### REQ-2.3-21 · MUST
While a ticket is in `TRIAGED` with a severity other than `P1`, when `category` is `infra`, the triage agent shall hand off to the diagnostics agent.
- Patrón: Complejo
- Verifica: `pnpm -F agent-spec test -- routing.triage`

#### REQ-2.3-22 · MUST
While a ticket is in `TRIAGED` with a severity other than `P1`, when `category` is `access`, the triage agent shall hand off to the diagnostics agent.
- Patrón: Complejo
- Verifica: `pnpm -F agent-spec test -- routing.triage`

#### REQ-2.3-23 · MUST
While a ticket is in `TRIAGED` with a severity other than `P1`, when `category` is `provisioning`, the triage agent shall hand off to the provisioning agent.
- Patrón: Complejo
- Verifica: `pnpm -F agent-spec test -- routing.triage`

#### REQ-2.3-24 · MUST
While a ticket is in `TRIAGED` with a severity other than `P1`, when `category` is `unknown`, the triage agent shall hand off to the escalation agent with reason `unknown_category`.
- Patrón: Complejo
- Verifica: `pnpm -F agent-spec test -- routing.triage`

#### REQ-2.3-25 · MUST
While a ticket is in `TRIAGED`, when `severity` is `P1`, the triage agent shall hand off to the escalation agent with reason `critical_severity`.
- Patrón: Complejo
- Verifica: `pnpm -F agent-spec test -- routing.triage`

#### REQ-2.3-26 · MUST
When the triage agent completes a classification in Copilot Chat, the triage agent shall recommend exactly one handoff according to the routing rules.
- Patrón: Evento
- Verifica: Manual M-05

### 3.4 Diagnóstico

#### REQ-2.3-27 · MUST
While a ticket has category `access`, when `entities.issueType` is `lockout`, the diagnostics agent shall execute the allowlisted action `instruct_self_service_unlock`.
- Patrón: Complejo
- Verifica: `pnpm -F api test -- graph.access-lockout`

#### REQ-2.3-28 · MUST
While a ticket has category `access`, when `entities.issueType` is `password_reset`, `mfa` or `disabled_account`, the diagnostics agent shall hand off to the escalation agent with reason `requires_identity_action`.
- Patrón: Complejo
- Verifica: `pnpm -F agent-spec test -- routing.diagnostics`

#### REQ-2.3-29 · MUST
While a ticket has category `infra`, when `entities.issueType` is `performance` or `app`, the diagnostics agent shall hand off to the escalation agent with reason `no_diagnostic_skill`.
- Patrón: Complejo
- Verifica: `pnpm -F agent-spec test -- routing.diagnostics`

#### REQ-2.3-30 · MUST
While a ticket has category `infra` or `access`, when `entities.issueType` is `unknown`, the diagnostics agent shall set the ticket to `WAITING_USER` with a `userMessage` that asks for the missing detail.
- Patrón: Complejo
- Verifica: `pnpm -F api test -- graph.waiting-user`

### 3.5 Allowlist de remediación

#### REQ-2.3-31 · MUST
If an agent requests an action absent from the remediation allowlist, then the runtime shall reject the action with the error `ACTION_NOT_ALLOWLISTED`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- allowlist.reject`

#### REQ-2.3-32 · MUST
If the runtime rejects an action with `ACTION_NOT_ALLOWLISTED`, then the diagnostics agent shall hand off to the escalation agent with reason `action_not_allowlisted`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- allowlist.escalate`

#### REQ-2.3-33 · MUST
If the remediation allowlist contains an action tagged `mfa`, `credentials` or `permissions`, then the spec validator shall report `UNSAFE_ALLOWLIST_ACTION`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- allowlist.unsafe`

#### REQ-2.3-34 · MUST
When the runtime starts, the runtime shall load the remediation allowlist from the table in `diagnostics.agent.md`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- allowlist.compiled`

### 3.6 Aprovisionamiento

#### REQ-2.3-35 · MUST
When the provisioning agent receives a ticket, the provisioning agent shall normalize `entities.request` with `resource`, `accessLevel` and `justification`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- provisioning.request`

#### REQ-2.3-36 · MUST
When the provisioning agent completes the approval request, the provisioning agent shall hand off to the escalation agent with reason `approval_required`.
- Patrón: Evento
- Verifica: `pnpm -F agent-spec test -- routing.provisioning`

---

## 4. REQ-2.4 · Prompt files

Fuente: PDF §2.4 · CLAUDE.md §2.4.

#### REQ-2.4-01 · MUST
If a `.prompt.md` frontmatter lacks `agent` or `tools`, then the spec validator shall report `PROMPT_FRONTMATTER_INVALID`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- prompts.frontmatter`

#### REQ-2.4-02 · MUST
If the `agent` value of a prompt file matches no `.agent.md` file, then the spec validator shall report `UNKNOWN_PROMPT_AGENT`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- prompts.agent`

#### REQ-2.4-03 · MUST
If `triage-ticket.prompt.md` lacks `${input:ticket}` or `${input:channel}`, then the spec validator shall report `PROMPT_VARIABLE_MISSING`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- prompts.variables`

#### REQ-2.4-04 · MUST
If `run-vpn-diagnostics.prompt.md` lacks `${input:ticketId}` or `${input:target}`, then the spec validator shall report `PROMPT_VARIABLE_MISSING`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- prompts.variables`

#### REQ-2.4-05 · MUST
If `escalate-ticket.prompt.md` lacks `${input:ticketId}` or `${input:reason}`, then the spec validator shall report `PROMPT_VARIABLE_MISSING`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- prompts.variables`

#### REQ-2.4-06 · MUST
If a prompt body contains no `#tool:<name>` reference, then the spec validator shall report `PROMPT_WITHOUT_TOOL_CALL`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- prompts.tool-call`

#### REQ-2.4-07 · MUST
If a `#tool:<name>` reference in a prompt body names a tool absent from the `tools` list of that prompt, then the spec validator shall report `PROMPT_TOOL_UNDECLARED`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- prompts.tool-call`

#### REQ-2.4-08 · MUST
When an operator runs `/triage-ticket` in Copilot Chat, the triage agent shall return `category`, `severity` and `entities` for the given ticket.
- Patrón: Evento
- Verifica: Manual M-02

#### REQ-2.4-09 · MUST
When an operator runs `/run-vpn-diagnostics` in Copilot Chat, the diagnostics agent shall run `check-vpn.js` against the `target` value.
- Patrón: Evento
- Verifica: Manual M-03

#### REQ-2.4-10 · MUST
When an operator runs `/escalate-ticket` in Copilot Chat, the escalation agent shall produce the escalation package for the given `ticketId` and `reason`.
- Patrón: Evento
- Verifica: Manual M-06

#### REQ-2.4-11 · MUST
When the api receives `POST /prompts/:name/run`, the runtime shall render the template replacing each `${input:<var>}` with the value sent in the request body.
- Patrón: Evento
- Verifica: `pnpm -F api test -- prompts.render`

#### REQ-2.4-12 · MUST
When the api receives `POST /prompts/:name/run`, the runtime shall start the graph at the agent named in the `agent` field of that prompt.
- Patrón: Evento
- Verifica: `pnpm -F api test -- prompts.entry-agent`

#### REQ-2.4-13 · MUST
If a `POST /prompts/:name/run` request omits a variable declared in the template, then the api shall respond `400` with the names of the missing variables.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- prompts.missing-variable`

#### REQ-2.4-14 · MUST
If `:name` matches no prompt file, then the api shall respond `404`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- prompts.not-found`

#### REQ-2.4-15 · MUST
If a `POST /prompts/:name/run` request references a `ticketId` that does not exist, then the api shall respond `404`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- prompts.unknown-ticket`

---

## 5. REQ-SEC · Seguridad y privacidad

Fuente: PDF §1.2 (Seguridad y Privacidad de Datos) · CLAUDE.md §0 y §3.3.

#### REQ-SEC-01 · MUST
When ticket text enters the runtime, the redact node shall replace every email address with `[EMAIL]` before any LLM call.
- Patrón: Evento
- Verifica: `pnpm -F api test -- redact.email`

#### REQ-SEC-02 · MUST
When ticket text enters the runtime, the redact node shall replace every phone number with `[PHONE]` before any LLM call.
- Patrón: Evento
- Verifica: `pnpm -F api test -- redact.phone`

#### REQ-SEC-03 · MUST
When ticket text enters the runtime, the redact node shall replace every JWT or token-like string with `[TOKEN]` before any LLM call.
- Patrón: Evento
- Verifica: `pnpm -F api test -- redact.token`

#### REQ-SEC-04 · MUST
When ticket text enters the runtime, the redact node shall replace every credential pattern such as `password: …` or `contraseña: …` with `[SECRET]` before any LLM call.
- Patrón: Evento
- Verifica: `pnpm -F api test -- redact.secret`

#### REQ-SEC-05 · MUST
When the redact node finds the identifier of the affected user, the redact node shall store an opaque `userRef` of the form `usr_<hash>` in `entities.userRef`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- redact.userref`

#### REQ-SEC-06 · MUST
When a prompt run receives free-text variables, the redact node shall process each variable before the runtime renders the template.
- Patrón: Evento
- Verifica: `pnpm -F api test -- redact.prompt-variables` (p. ej. `${input:reason}` con un email sintético)

#### REQ-SEC-07 · MUST
The runtime shall persist only the redacted version of the ticket text.
- Patrón: Ubicuo
- Verifica: `pnpm -F api test -- redact.persistence` (tras un recorrido con PII sintética, `grep` sobre `data/` no encuentra los valores originales)

#### REQ-SEC-08 · MUST
The runtime shall exclude ticket text from application logs.
- Patrón: Ubicuo
- Verifica: `pnpm -F api test -- redact.logs` (captura del logger durante un recorrido completo)

#### REQ-SEC-09 · MUST
If an audit entry contains a string that matches a redaction pattern, then the audit log shall replace that string with its placeholder before writing.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- audit.redaction`

#### REQ-SEC-10 · MUST
If a generated `userMessage` asks the user for a password, a token or an MFA code, then the runtime shall replace the message with the plain-language template for the ticket outcome.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- guard.credential-request` (el modelo fake genera un mensaje que pide la contraseña; casos negativos: "indica el código del caso" e "indica el paso clave" no saltan)

#### REQ-SEC-11 · MUST
If a ticket in Copilot Chat contains a credential, then the triage agent shall omit that credential from every response.
- Patrón: No deseado
- Verifica: Manual M-07

#### REQ-SEC-12 · SHOULD
If a ticket contains a credential, then the triage agent shall recommend that the user change the exposed credential.
- Patrón: No deseado
- Verifica: Manual M-07
- Nota: solo en modo Copilot en v1 (D-10). En el runtime el nodo triage no redacta `userMessage`.

#### REQ-SEC-13 · SHOULD
If a file under `.github/` or a test fixture contains an email address outside the domains `example.com` and `example.internal`, then the spec validator shall report `PII_IN_FIXTURE`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- pii.fixtures`

#### REQ-SEC-14 · SHOULD
If a prompt run requests a `target` outside the `VPN_ALLOWED_TARGETS` list, then the api shall respond `400`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- prompts.target-allowlist`

#### REQ-SEC-15 · MUST
If the `target` value does not match `^[a-z0-9.-]+:\d{1,5}$`, then the diagnostics agent shall refuse to run `check-vpn.js`.
- Patrón: No deseado
- Verifica: Manual M-08 (`target` = `x:1; echo INJECTED`: no se ejecuta ningún comando) + `pnpm -F api test -- prompts.target-format` (en el runtime la api responde `400` antes de llegar al agente)

---

## 6. REQ-AUD / REQ-ESC · Bitácora y escalamiento

Fuente: PDF §1.2 (Escalamiento y Trazabilidad) · CLAUDE.md §0 y §3.3.

### 6.1 Bitácora

#### REQ-AUD-01 · MUST
The audit log shall be append-only.
- Patrón: Ubicuo
- Verifica: `pnpm -F api test -- audit.append-only` (el módulo solo expone `append`; escrituras en modo `a`; las líneas previas no cambian)

#### REQ-AUD-02 · MUST
The audit log shall store entries as JSON Lines in `data/audit/<ticketId>.jsonl`.
- Patrón: Ubicuo
- Verifica: `pnpm -F api test -- audit.jsonl`

#### REQ-AUD-03 · MUST
When the runtime applies a status transition, the audit log shall record an entry with `ts`, `agent`, `decision`, `reason`, `from` and `to`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- audit.transition`

#### REQ-AUD-04 · MUST
When an agent takes a routing decision, the audit log shall record an entry with the chosen target and the matched rule.
- Patrón: Evento
- Verifica: `pnpm -F api test -- audit.routing`

#### REQ-AUD-05 · MUST
When the runtime executes a tool, the audit log shall record the tool name, the result status and the duration.
- Patrón: Evento
- Verifica: `pnpm -F api test -- audit.tool`

#### REQ-AUD-06 · MUST
If the audit log fails to write an entry, then the runtime shall stop the graph execution for that ticket with the error `AUDIT_WRITE_FAILED`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- audit.write-failure` (directorio de bitácora sin permisos de escritura)

#### REQ-AUD-07 · MUST
When the triage agent completes a classification in Copilot Chat, the triage agent shall append an audit entry to `data/audit/<ticketId>.jsonl`.
- Patrón: Evento
- Verifica: Manual M-02

#### REQ-AUD-08 · MUST
If the ticket store fails to write the ticket state, then the runtime shall stop the graph execution for that ticket with the error `STORE_WRITE_FAILED`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- store.write-failure`

### 6.2 Escalamiento

#### REQ-ESC-01 · MUST
When the escalation agent receives a case, the escalation agent shall produce an escalation package with `ticketId`, `category`, `severity`, `entities`, `findings` and `reason`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- escalation.package`

#### REQ-ESC-02 · MUST
When the escalation agent completes the escalation package, the runtime shall set the ticket status to `ESCALATED`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- escalation.status`

#### REQ-ESC-03 · MUST
When the escalation agent completes the escalation package, the runtime shall end the graph execution for that ticket.
- Patrón: Evento
- Verifica: `pnpm -F api test -- escalation.terminal`

#### REQ-ESC-04 · MUST
If an LLM call of the triage agent fails or exceeds 30 s, then the runtime shall route the ticket to the escalation agent with reason `llm_unavailable`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- llm.failure` (modelo fake que lanza error / no responde)

#### REQ-ESC-05 · MUST
If an agent output fails schema validation, then the runtime shall route the ticket to the escalation agent with reason `invalid_llm_output`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- llm.invalid-output`

#### REQ-ESC-06 · MUST
While the LLM provider is unavailable, the escalation agent shall build the escalation package from a deterministic template.
- Patrón: Estado
- Verifica: `pnpm -F api test -- escalation.llm-down`

#### REQ-ESC-07 · SHOULD
When the escalation agent builds the escalation package, the escalation agent shall assign `targetTeam` from the category-to-team table in `escalation.agent.md`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- escalation.target-team`

#### REQ-ESC-08 · MUST
If a node raises an unexpected error, then the runtime shall route the ticket to the escalation agent with reason `internal_error`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- graph.internal-error`

#### REQ-ESC-09 · MUST
While a ticket has category `provisioning`, when the escalation agent builds the escalation package, the escalation agent shall derive `approvalRequest` from `entities.request` and `entities.userRef`.
- Patrón: Complejo
- Verifica: `pnpm -F api test -- escalation.approval-request`

#### REQ-ESC-10 · MUST
If the escalation agent raises an error other than an I/O error, then the escalation agent shall build the escalation package from the deterministic template.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- escalation.fallback` (el nodo lanza una excepción; el ticket termina en `ESCALATED`)

---

## 7. REQ-COM · Comunicación con el usuario final

Fuente: PDF §1.2 (Comunicación) · CLAUDE.md §0.

#### REQ-COM-01 · MUST
If a transition to `ESCALATED` or `WAITING_USER` is requested while `userMessage` is empty, then the runtime shall reject the transition with the error `MISSING_REQUIRED_FIELDS`.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- lifecycle.required-fields`

#### REQ-COM-02 · MUST
If a `userMessage` contains a term from the jargon list in `copilot-instructions.md`, then the runtime shall replace the message with the plain-language template for the ticket outcome.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- guard.jargon` (el modelo fake genera "el gateway no responde por TCP")

#### REQ-COM-03 · MUST
When a ticket reaches `ESCALATED`, the escalation agent shall include the `ticketId` in `userMessage` as the follow-up reference.
- Patrón: Evento
- Verifica: `pnpm -F api test -- escalation.user-message`

#### REQ-COM-04 · SHOULD
If a `userMessage` contains a `userRef` or a JSON fragment, then the runtime shall replace the message with the plain-language template for the ticket outcome.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- guard.internal-data`

#### REQ-COM-05 · MUST
When the diagnostics agent drafts a message for the end user in Copilot Chat, the diagnostics agent shall write that message in Spanish without terms from the jargon list.
- Patrón: Evento
- Verifica: Manual M-03

#### REQ-COM-06 · MUST
If an LLM call that drafts a `userMessage` or a summary fails or exceeds 30 s, then the runtime shall use the plain-language template for that text.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- llm.drafting-fallback`

---

## 8. REQ-API · Runtime y API

Fuente: CLAUDE.md §3.2 y §3.4 (plus, salvo API-01).

#### REQ-API-01 · MUST
If the `.github/` spec fails validation at startup, then the runtime shall abort startup with the list of validation errors.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- bootstrap.invalid-spec`

#### REQ-API-02 · SHOULD
When the api receives `POST /tickets`, the api shall respond `202` with the new `ticketId`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- tickets.create`

#### REQ-API-03 · SHOULD
When the api accepts a new ticket, the runtime shall run the graph starting at the redact node.
- Patrón: Evento
- Verifica: `pnpm -F api test -- tickets.create`

#### REQ-API-04 · SHOULD
When the api receives `GET /tickets`, the api shall return every ticket with `ticketId`, `category`, `severity`, `status` and `slaDueAt`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- tickets.list`

#### REQ-API-05 · SHOULD
When the api receives `GET /tickets/:id`, the api shall return the `TicketState` of that ticket.
- Patrón: Evento
- Verifica: `pnpm -F api test -- tickets.detail`

#### REQ-API-06 · SHOULD
When the api receives `GET /tickets/:id/audit`, the api shall return the audit entries of that ticket in write order.
- Patrón: Evento
- Verifica: `pnpm -F api test -- tickets.audit`

#### REQ-API-07 · SHOULD
When a client connects to `GET /tickets/:id/events`, the api shall stream node, handoff and transition events as Server-Sent Events.
- Patrón: Evento
- Verifica: `pnpm -F api test -- tickets.sse`

#### REQ-API-08 · SHOULD
When the api receives `POST /tickets/:id/reply` with an `issueType` for a ticket in `WAITING_USER`, the runtime shall resume the graph at the diagnostics agent.
- Patrón: Evento
- Verifica: `pnpm -F api test -- tickets.reply`

#### REQ-API-09 · SHOULD
When the api receives `POST /tickets/:id/close` for a ticket in `RESOLVED` or `ESCALATED`, the runtime shall set the ticket status to `CLOSED`.
- Patrón: Evento
- Verifica: `pnpm -F api test -- tickets.close`

#### REQ-API-10 · SHOULD
When the api receives `GET /health`, the api shall return the active LLM provider and the spec validation status.
- Patrón: Evento
- Verifica: `pnpm -F api test -- health`

#### REQ-API-11 · SHOULD
If a request body fails schema validation, then the api shall respond `400` with the validation errors.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- validation.body`

---

## 9. REQ-LLM · Proveedor LLM

Fuente: CLAUDE.md §3.5.

#### REQ-LLM-01 · SHOULD
Where `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_DEPLOYMENT` are set, the runtime shall use `AzureChatOpenAI` as the LLM provider.
- Patrón: Opcional
- Verifica: `pnpm -F api test -- llm.provider` (variables sintéticas; no se hace ninguna llamada de red)

#### REQ-LLM-02 · SHOULD
Where the Azure OpenAI variables are absent and `ANTHROPIC_API_KEY` is set, the runtime shall use `ChatAnthropic` as the LLM provider.
- Patrón: Opcional
- Verifica: `pnpm -F api test -- llm.provider`

#### REQ-LLM-03 · SHOULD
If no LLM provider variables are set, then the runtime shall start with the deterministic fake model.
- Patrón: No deseado
- Verifica: `pnpm -F api test -- llm.provider` + `GET /health` informa `fake`

#### REQ-LLM-04 · MUST
While `NODE_ENV` is `test`, the runtime shall use the deterministic fake model.
- Patrón: Estado
- Verifica: `pnpm -F api test -- llm.test-mode`

---

## 10. REQ-WEB · Frontend Angular

Fuente: CLAUDE.md §3.4 (plus).

#### REQ-WEB-01 · SHOULD
When the operator opens the inbox view, the web app shall list tickets with `ticketId`, `category`, `severity`, `status` and SLA.
- Patrón: Evento
- Verifica: `pnpm -F web test -- inbox`

#### REQ-WEB-02 · SHOULD
When the operator opens a ticket, the web app shall display a timeline with visited nodes, handoffs, decisions and durations.
- Patrón: Evento
- Verifica: `pnpm -F web test -- timeline`

#### REQ-WEB-03 · SHOULD
When the operator opens the audit view of a ticket, the web app shall display the audit entries in write order.
- Patrón: Evento
- Verifica: `pnpm -F web test -- audit-view`

#### REQ-WEB-04 · SHOULD
While a ticket graph is running, the web app shall append the events received over SSE to the timeline without a page reload.
- Patrón: Estado
- Verifica: `pnpm -F web test -- timeline.sse`

#### REQ-WEB-05 · SHOULD
If the SSE connection drops, then the web app shall retry the connection every 5 s.
- Patrón: No deseado
- Verifica: `pnpm -F web test -- timeline.reconnect`

#### REQ-WEB-06 · SHOULD
The web app shall display only the redacted ticket text.
- Patrón: Ubicuo
- Verifica: `pnpm -F web test -- redacted-only`

#### REQ-WEB-07 · SHOULD
When the operator submits the new-ticket form, the web app shall send the text to `POST /prompts/triage-ticket/run`.
- Patrón: Evento
- Verifica: `pnpm -F web test -- new-ticket`

#### REQ-WEB-08 · SHOULD
When the operator opens the root path `/`, the web app shall redirect to the inbox view `/tickets`.
- Patrón: Evento
- Verifica: `pnpm -F web test -- app.smoke`
- Nota: test de humo del scaffold de Angular; aísla los problemas del CLI y del runner de tests del código de las vistas.

---

## 11. REQ-VAL · Validador de la spec (`pnpm spec:validate`)

Fuente: CLAUDE.md §3.2 y §2.4 (nota sobre claves inventadas).

#### REQ-VAL-01 · MUST
If a required `.github/` file listed in Annex D is missing, then the spec validator shall report `REQUIRED_FILE_MISSING` with the file path.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- validate.required-files`

#### REQ-VAL-02 · MUST
If a frontmatter block is not valid YAML, then the spec validator shall report `FRONTMATTER_PARSE_ERROR`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- validate.yaml`

#### REQ-VAL-03 · MUST
If a frontmatter contains a key outside the documented VS Code set for its file type in Annex A, then the spec validator shall report `UNKNOWN_FRONTMATTER_KEY`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- validate.unknown-key` (fixture con `infer` y con una clave inventada)

#### REQ-VAL-04 · MUST
When the spec validator finds no errors, the spec validator shall exit with code `0`.
- Patrón: Evento
- Verifica: `pnpm spec:validate` sobre el `.github/` real

#### REQ-VAL-05 · MUST
If the spec validator finds at least one error, then the spec validator shall exit with code `1`.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- validate.exit-code`

#### REQ-VAL-06 · MUST
When the spec validator reports an error, the spec validator shall print the error code with the path of the offending file.
- Patrón: Evento
- Verifica: `pnpm -F agent-spec test -- validate.output`

#### REQ-VAL-07 · SHOULD
If a requirement with priority `MUST` in `specs/requirements.md` appears in no task of `specs/tasks.md`, then the spec validator shall report `REQ_WITHOUT_TASK`.
- Patrón: No deseado
- Verifica: `pnpm test -- trace.check` (fixture con una MUST sin tarea)
- Nota: lo implementa `scripts/trace.mjs`, que `pnpm spec:validate` encadena. Como CI ejecuta `spec:validate` (REQ-CI-01), el pipeline falla si una MUST queda sin tarea. El arranque del api solo valida `.github/` (REQ-API-01).

---

## 12. REQ-CI · Integración continua

Fuente: CLAUDE.md §1, §3.2 y §6 (plus).

#### REQ-CI-01 · SHOULD
When a commit is pushed, the ci pipeline shall run `pnpm spec:validate`.
- Patrón: Evento
- Verifica: inspección de `azure-pipelines.yml` + ejecución verde en Azure DevOps

#### REQ-CI-02 · SHOULD
When a commit is pushed, the ci pipeline shall run `pnpm test`.
- Patrón: Evento
- Verifica: inspección de `azure-pipelines.yml` + ejecución verde en Azure DevOps

#### REQ-CI-03 · SHOULD
When a commit is pushed, the ci pipeline shall run the ESLint and Prettier checks.
- Patrón: Evento
- Verifica: inspección de `azure-pipelines.yml`

#### REQ-CI-04 · SHOULD
If the line coverage of `packages/agent-spec` is below 90 %, then the ci pipeline shall fail the build.
- Patrón: No deseado
- Verifica: `pnpm -F agent-spec test -- --coverage` con umbral configurado en vitest

---

## 13. REQ-DOC · Documentación

Fuente: CLAUDE.md §4 (Fase 4: README con diagrama Mermaid del grafo y guion de demo).

#### REQ-DOC-01 · SHOULD
When `pnpm spec:graph` runs, the spec validator shall print a Mermaid flowchart of the compiled handoff graph.
- Patrón: Evento
- Verifica: `pnpm -F agent-spec test -- docs.readme-graph` (la salida coincide con el diagrama incrustado en `README.md`)
- Nota: así el diagrama del README sale de `.github/` y no se escribe a mano (ADR-01).

---

## 14. Decisiones asumidas y preguntas abiertas

| ID | Decisión | Estado |
| --- | --- | --- |
| D-01 | "Diagnóstico OK" = **hallazgo concluyente**: el recurso respondió (exit `0` o `1`) y la causa está identificada. No significa "todos los checks pasaron". | ✅ Aprobada 2026-09-23 |
| D-02 | Se añade `the ci pipeline` como 12.º nombre de sistema: la lista de `CLAUDE.md` no tiene ninguno para CI. | ✅ Aprobada 2026-09-23 |
| D-03 | `MUST` incluye los tests de runtime que `CLAUDE.md` §2 pone como criterio (máquina de estados, tool con timeout, DAG, `POST /prompts/:name/run`). | ✅ Aprobada 2026-09-23 |
| D-04 | `P1` escala directo a `escalation`, sin diagnóstico automático. | Asumida |
| D-05 | Acceso: solo `lockout` se resuelve (instrucción de desbloqueo por autoservicio). `password_reset`, `mfa` y `disabled_account` escalan. | Asumida |
| D-06 | VPN: exit `0` → instrucción de reconexión (`RESOLVED`); exit `1` → escalar `vpn_gateway_unhealthy`; exit `2` o timeout → escalar `skill_resource_unavailable`. | Asumida |
| D-07 | Se añade `entities.issueType` para enrutar en `diagnostics` sin ampliar el contexto de handoff fijado en `CLAUDE.md`. | Asumida |
| D-08 | En Copilot Chat los agentes guardan tickets en `data/tickets/<ticketId>.json`; así `applyTo: "**/tickets/**"` activa las reglas del ciclo de vida justo al actualizar un ticket. | Asumida |
| D-09 | Sin variables de LLM, el runtime arranca con el modelo fake (demo sin secretos). | Asumida |
| D-10 | REQ-SEC-12 (recomendar el cambio de una credencial expuesta) se cubre solo en modo Copilot en v1. | ✅ Aprobada 2026-09-23 |
| D-11 | Sin `.vscode/settings.json` de auto-aprobación: en modo Copilot, la confirmación manual de cada ejecución de `check-vpn.js` es la guarda frente a la inyección de comandos (R-05). | ✅ Aprobada 2026-09-23 |
| D-12 | Plan B de R-02: `diagnostics`, `provisioning` y `escalation` con `user-invocable: true` y `disable-model-invocation: true`. En VS Code 1.138 un agente con `user-invocable: false` aparece como `Unknown agent` en los handoffs y en el `agent` de los prompt files. | ✅ Aprobada 2026-09-23 |

### Riesgos a verificar en Fase 1

- **R-01 (confirmado en la doc de VS Code).** Al ejecutar un handoff, VS Code conserva el historial de la conversación. En Copilot Chat, "solo el contexto necesario" se consigue con el `prompt` del handoff y las instrucciones del agente; el aislamiento estricto lo garantiza el runtime (REQ-2.3-17).
- **R-02 (materializado en Fase 1, resuelto con D-12).** En VS Code 1.138 un agente con `user-invocable: false` no sirve como destino de handoff ni como `agent` de un prompt file: el editor lo marca como `Unknown agent`.

---

## 15. Fuera de alcance (v1)

- Integración real con directorio (AD/Entra ID), ITSM o VPN corporativa. Todo se ejecuta contra objetivos sintéticos o locales.
- Ejecución real de remediaciones sobre sistemas. Las acciones de la allowlist son instrucciones al usuario o acciones simuladas que quedan en la bitácora.
- Autenticación de operadores en la api y la web app.
- Base de datos: el estado va en `data/tickets/*.json` y la bitácora en `data/audit/*.jsonl`.

---

## Anexo A · Claves de frontmatter permitidas (doc oficial de VS Code, verificada el 2026-09-23)

| Archivo | Claves permitidas |
| --- | --- |
| `*.agent.md` | `description`, `name`, `argument-hint`, `tools`, `agents`, `model`, `user-invocable`, `disable-model-invocation`, `target`, `mcp-servers`, `handoffs`, `hooks` (`infer` está obsoleta y se rechaza) |
| `handoffs[]` | `label`, `agent`, `prompt`, `send`, `model` |
| `SKILL.md` | `name` (minúsculas, dígitos y guiones; ≤ 64; igual al nombre de la carpeta), `description` (≤ 1024), `argument-hint`, `user-invocable`, `disable-model-invocation`, `context` |
| `*.prompt.md` | `description`, `name`, `argument-hint`, `agent`, `model`, `tools` |
| `*.instructions.md` | `name`, `description`, `applyTo` |

Sintaxis del cuerpo de los prompt files: variables `${input:nombre}` y `${input:nombre:placeholder}`; referencia a tools `#tool:<nombre>`.

Fuentes: [custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents) · [agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) · [prompt files](https://code.visualstudio.com/docs/copilot/customization/prompt-files) · [custom instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions).

## Anexo B · Tabla de agentes (de `CLAUDE.md` §2.3; no cambiar sin aprobación)

Cita de la fuente normativa `packages/agent-spec/src/policy.ts`. Si difieren, gana `policy.ts`, y cambiar cualquiera de los dos requiere aprobación.

Cambio aprobado el 2026-09-23 (D-12, plan B de R-02): `diagnostics`, `provisioning` y `escalation` pasan de `user-invocable: false` a `true` con `disable-model-invocation: true`.

| Agente | `user-invocable` | Handoffs permitidos |
| --- | --- | --- |
| `triage` | `true` | → `diagnostics`, → `provisioning`, → `escalation` |
| `diagnostics` | `true` + `disable-model-invocation: true` | → `escalation` |
| `provisioning` | `true` + `disable-model-invocation: true` | → `escalation` |
| `escalation` | `true` + `disable-model-invocation: true` | ninguno (terminal) |

## Anexo C · Pruebas manuales en Copilot Chat (detalle en `docs/manual-tests.md`, Fase 1)

| ID | Qué se hace | Qué se comprueba | REQ |
| --- | --- | --- | --- |
| M-01 | Adjuntar al chat un ticket creado por `/triage-ticket` (estado `TRIAGED`) y pedir a `triage` que lo pase a `RESOLVED` | Rechaza la transición, cita las permitidas desde `TRIAGED` (`IN_PROGRESS`, `ESCALATED`) y Copilot lista `ticket-lifecycle.instructions.md` entre las referencias usadas | 2.1-13 |
| M-02 | `/triage-ticket` con un ticket VPN sintético | Devuelve la clasificación, crea `data/tickets/<id>.json` con estado `TRIAGED` y añade la entrada en `data/audit/<id>.jsonl` | 2.1-12, 2.4-08, AUD-07 |
| M-03 | `/run-vpn-diagnostics` con `target=localhost:<puerto abierto>` | Carga `SKILL.md`, ejecuta el script y redacta un mensaje en español sin jerga | 2.2-09, 2.4-09, COM-05 |
| M-04 | Renombrar temporalmente `check-vpn.js` (p. ej. a `check-vpn.js.off`) y ejecutar `/run-vpn-diagnostics` con `target=localhost:<puerto abierto>`. Restaurar el nombre al terminar | Node sale con exit `1` sin JSON; el agente lo trata como `skill_resource_unavailable`, lo registra en la bitácora y hace handoff a `escalation` | 2.2-30 |
| M-05 | Triage de tickets `infra`, `provisioning` y `P1` | Recomienda exactamente un handoff, según las reglas | 2.3-26 |
| M-06 | `/escalate-ticket` sobre un ticket existente | Genera el paquete de escalamiento | 2.4-10 |
| M-07 | Ticket con una contraseña sintética | La respuesta no repite la contraseña | SEC-11, SEC-12 |
| M-08 | `/run-vpn-diagnostics` con `target=x:1; echo INJECTED` | El agente rechaza el target, no ejecuta ningún comando en la terminal y pide un target válido | SEC-15 |
| M-09 | Tras escribir cada `.agent.md`, abrir su selector de tools y anotar la versión de VS Code | Todas las tools de su `tools` aparecen resueltas (VS Code ignora sin avisar las que no reconoce) | R-06 |

## Anexo D · Archivos obligatorios en `.github/`

- `.github/copilot-instructions.md`
- `.github/instructions/ticket-lifecycle.instructions.md`
- `.github/skills/vpn-diagnostics/SKILL.md`
- `.github/skills/vpn-diagnostics/scripts/check-vpn.js`
- `.github/agents/{triage,diagnostics,provisioning,escalation}.agent.md`
- `.github/prompts/{triage-ticket,run-vpn-diagnostics,escalate-ticket}.prompt.md`

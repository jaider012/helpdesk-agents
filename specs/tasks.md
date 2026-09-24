# Tareas — Ecosistema de Agentes Help Desk

> **Fase 0 · v0.3 · 2026-09-23 · Estado: aprobado 2026-09-23 (`aprobado fase 0`)** (v0.3: scaffold de Angular separado de la bandeja, T-74/T-75. v0.2: revisión con 4 puntos — M-04 ejecutable, tickets antes de las pruebas manuales, T-01 y la antigua T-29 divididas, tarea para `scripts/trace.mjs` — y Q-01..Q-03 resueltas)
> Implementa `specs/requirements.md` v0.4 y `specs/design.md` v0.3. Cada tarea cita los `REQ` que satisface; la tabla de trazabilidad del final se genera desde las líneas `Satisface:` (hasta T-19 con un script temporal; después con `scripts/trace.mjs`).

---

## 0. Convenciones

- **Plantilla fija.** Cada tarea tiene título imperativo, `Satisface`, `Hecho cuando` (una sentencia EARS en inglés, con los nombres de sistema de `requirements.md` §0), `Verifica` y `Bloqueada por`.
- **Tamaño.** ≤ 1 h por tarea. Las referencias `design §x` del título indican el contenido exacto que se implementa. El scaffold de cada toolchain va en su propia tarea, separado del código de producto.
- **Gates.** La primera tarea de cada fase necesita el mensaje literal del gate anterior (`aprobado fase N`). `Bloqueada por` solo lista dependencias entre tareas.
- **Tests automáticos.**
  - `pnpm -F <paquete> test -- <patrón> [<patrón>…]`: cada patrón es un archivo `<patrón>.test.ts` del paquete; vitest filtra por ruta.
  - `pnpm test -- check-vpn.<x>`, `pnpm test -- trace.<x>` y `pnpm test -- ci.<x>`: proyecto vitest de la raíz (`tests/`).
  - Nombres de paquete sin scope: `agent-spec`, `api`, `web` (así `-F` coincide).
- **Tests manuales.** `Manual M-xx` = prueba del Anexo C de `requirements.md`. La evidencia (fecha, versión de VS Code, resultado y nota o captura) se registra en `docs/manual-tests.md`.
  - M-09 (tools resueltas, R-06) se ejecuta en la tarea que escribe cada `.agent.md`.
  - T-12 y T-13 añaden a M-05 el paso de pulsar el handoff; queda documentado en `docs/manual-tests.md` sin cambiar el Anexo C.
- **Cierre de cada tarea** (CLAUDE.md §0): `Verifica` en verde → `[x]` → línea en `specs/changelog.md`.

### Resumen

| Fase | Tareas | Contenido | Gate de entrada |
| --- | --- | --- | --- |
| 1 | T-01 … T-16 | `check-vpn.js` con tests + `.github/` probado en Copilot Chat | `aprobado fase 0` |
| 2 | T-17 … T-72 | `packages/agent-spec` (validador, routing, trazabilidad) + grafo LangGraph + API NestJS | `aprobado fase 1` |
| 3 | T-73 … T-81 | SSE + Angular (bandeja, timeline, bitácora, formulario) | `aprobado fase 2` |
| 4 | T-82 … T-86 | Azure OpenAI / Anthropic, `azure-pipelines.yml`, README | `aprobado fase 3` |

---

## Fase 1 · `.github/` funcionando en Copilot Chat

Gate de entrada: `aprobado fase 0`. Primero el script (tests automáticos). Después los `.md`, en un orden que garantiza que cada prueba manual tenga lo que necesita: `/triage-ticket` (T-09) llega antes que cualquier prueba que trabaje sobre un ticket existente.

- [x] T-01 · Crear el workspace pnpm (vitest con proyectos, ESLint, Prettier, `.gitignore`, `data/.gitkeep`, `AGENTS.md -> CLAUDE.md`) con el esqueleto de `check-vpn.js` · Satisface: REQ-2.2-22
  Hecho cuando: The check-vpn script shall import only the modules `node:dns`, `node:net` and `node:perf_hooks`.
  Verifica: `pnpm test -- check-vpn.imports` y `pnpm lint`
  Bloqueada por: ninguna

- [x] T-02 · Validar los argumentos de `check-vpn.js` y emitir el JSON de error · Satisface: REQ-2.2-19, REQ-2.2-21
  Hecho cuando: If the check-vpn script runs without `--target` or with a `--target` value without port, then the check-vpn script shall print one JSON object with `ok` set to `false` and a non-null `error` and exit with code `2`.
  Verifica: `pnpm test -- check-vpn.exit2`
  Bloqueada por: T-01

- [x] T-03 · Implementar los checks `dns`, `tcp` y `latency` de `check-vpn.js` (design §6.2) · Satisface: REQ-2.2-10, REQ-2.2-11, REQ-2.2-12, REQ-2.2-17
  Hecho cuando: When the check-vpn script runs with `--target localhost:<port>` against a listening local server, the check-vpn script shall report the checks `dns`, `tcp` and `latency` as `pass`, include the connection latency in milliseconds and exit with code `0`.
  Verifica: `pnpm test -- check-vpn.dns check-vpn.tcp check-vpn.latency check-vpn.exit0`
  Bloqueada por: T-02

- [x] T-04 · Añadir el umbral de latencia y el exit code `1` a `check-vpn.js` · Satisface: REQ-2.2-13, REQ-2.2-18
  Hecho cuando: Where `--latency-threshold-ms` is provided, when the measured latency exceeds that threshold, the check-vpn script shall mark the `latency` check as `fail` and exit with code `1`.
  Verifica: `pnpm test -- check-vpn.threshold check-vpn.exit1`
  Bloqueada por: T-03

- [x] T-05 · Añadir el timeout por check (`--timeout-ms`) a `check-vpn.js` · Satisface: REQ-2.2-14, REQ-2.2-15
  Hecho cuando: If a DNS or TCP check does not complete within the value of `--timeout-ms`, then the check-vpn script shall mark that check as `fail` with reason `timeout`.
  Verifica: `pnpm test -- check-vpn.timeout-arg check-vpn.check-timeout`
  Bloqueada por: T-03

- [x] T-06 · Añadir el plazo total (`DEFAULT_DEADLINE_MS = 9000`, `--deadline-ms`) y fijar el esquema de salida de `check-vpn.js` · Satisface: REQ-2.2-16, REQ-2.2-20
  Hecho cuando: If the total execution exceeds the deadline, then the check-vpn script shall print one JSON object with the keys `ok`, `checks` and `summary` and `error.code` set to `DEADLINE_EXCEEDED`, and exit with code `2`.
  Verifica: `pnpm test -- check-vpn.deadline check-vpn.output-schema`
  Bloqueada por: T-04, T-05

- [x] T-07 · Escribir `triage.agent.md` (design §2.1, §4, §5.2–5.4, §8.1 modo Copilot) y crear `docs/manual-tests.md` · Satisface: REQ-2.3-26
  Hecho cuando: When the triage agent completes a classification in Copilot Chat, the triage agent shall recommend exactly one handoff according to the routing rules.
  Verifica: Manual M-05 (tickets `infra`, `provisioning` y `P1`) y M-09 (tools de `triage`)
  Bloqueada por: ninguna

- [x] T-08 · Escribir `copilot-instructions.md` con reglas de PII, tono, lista de jerga y plantillas de mensaje (design §8.1, §9) · Satisface: REQ-SEC-11, REQ-SEC-12
  Hecho cuando: If a ticket in Copilot Chat contains a credential, then the triage agent shall omit that credential from every response and recommend that the user change the exposed credential.
  Verifica: Manual M-07
  Bloqueada por: T-07

- [x] T-09 · Escribir `triage-ticket.prompt.md` (design §7) · Satisface: REQ-2.4-08, REQ-2.1-12, REQ-AUD-07
  Hecho cuando: When an operator runs `/triage-ticket` in Copilot Chat, the triage agent shall return `category`, `severity` and `entities`, save `data/tickets/<ticketId>.json` with status `TRIAGED` and append an audit entry to `data/audit/<ticketId>.jsonl`.
  Verifica: Manual M-02
  Bloqueada por: T-07, T-08

- [x] T-10 · Escribir `ticket-lifecycle.instructions.md` con la tabla de transiciones, la definición de resuelto y el SLA (design §3.1–3.2) · Satisface: REQ-2.1-13
  Hecho cuando: If an operator asks the triage agent in Copilot Chat to apply a transition absent from the transitions table, then the triage agent shall refuse the transition citing the allowed transitions from the current status.
  Verifica: Manual M-01 (ticket creado en M-02 y adjunto al chat)
  Bloqueada por: T-09

- [x] T-11 · Escribir `escalation.agent.md` y `escalate-ticket.prompt.md` (design §4 `EscalationPackage`, §5.2, §5.6, §7) · Satisface: REQ-2.4-10
  Hecho cuando: When an operator runs `/escalate-ticket` in Copilot Chat, the escalation agent shall produce the escalation package for the given `ticketId` and `reason`.
  Verifica: Manual M-06 (confirma además el plan B de R-02: `escalation` sirve como `agent` de un prompt file) y M-09 (tools de `escalation`)
  Bloqueada por: T-10

- [x] T-12 · Escribir `provisioning.agent.md` (design §4 `Entities.request`, §5.2, §5.4) · Satisface: REQ-2.3-36
  Hecho cuando: When the provisioning agent completes the approval request in Copilot Chat, the provisioning agent shall hand off to the escalation agent with reason `approval_required`.
  Verifica: Manual M-05 (ticket `provisioning`: pulsar «Preparar solicitud de aprobación» y después «Enviar a aprobación») y M-09 (tools de `provisioning`)
  Bloqueada por: T-11

- [x] T-13 · Escribir `diagnostics.agent.md` con el procedimiento determinista y la allowlist de remediación (design §2.2, §5.2, §5.5) · Satisface: REQ-2.3-27
  Hecho cuando: While a ticket has category `access`, when `entities.issueType` is `lockout`, the diagnostics agent shall deliver the allowlisted instruction `instruct_self_service_unlock` to the user.
  Verifica: Manual M-05 (ticket `access/lockout`: pulsar «Diagnosticar») y M-09 (tools de `diagnostics`)
  Bloqueada por: T-11

- [x] T-14 · Escribir el procedimiento de `SKILL.md` de `vpn-diagnostics` y `run-vpn-diagnostics.prompt.md` (design §6.1, §7) · Satisface: REQ-2.2-09, REQ-2.4-09, REQ-COM-05
  Hecho cuando: When an operator runs `/run-vpn-diagnostics` in Copilot Chat, the diagnostics agent shall apply the `vpn-diagnostics` skill, run `check-vpn.js` against the `target` value and write the message for the end user in Spanish without terms from the jargon list.
  Verifica: Manual M-03
  Bloqueada por: T-06, T-13

- [x] T-15 · Añadir a `SKILL.md` el paso que valida el formato de `target` antes de ejecutar (design §6.1, §6.3) · Satisface: REQ-SEC-15
  Hecho cuando: If the `target` value does not match `^[a-z0-9.-]+:\d{1,5}$`, then the diagnostics agent shall refuse to run `check-vpn.js`.
  Verifica: Manual M-08
  Bloqueada por: T-14

- [x] T-16 · Añadir a `SKILL.md` la sección `Manejo de fallos` (timeout 10 s, salida no JSON = `skill_resource_unavailable`, bitácora, handoff; design §6.1) · Satisface: REQ-2.2-30
  Hecho cuando: If `check-vpn.js` exits with code `2`, prints output that is not valid JSON or does not respond within 10 s during a Copilot Chat session, then the diagnostics agent shall hand off to the escalation agent with reason `skill_resource_unavailable`.
  Verifica: Manual M-04 (con `check-vpn.js` renombrado temporalmente: Node sale con exit `1` sin JSON)
  Bloqueada por: T-14

---

## Fase 2 · `packages/agent-spec`, grafo LangGraph y API NestJS

Gate de entrada: `aprobado fase 1`. Primero el validador (`spec:validate` en verde sobre el `.github/` real), después el runtime MUST y al final los extras SHOULD de la API.

### 2.1 Validador, trazabilidad y routing (`packages/agent-spec`, `scripts/`)

- [x] T-17 · Crear `packages/agent-spec` con el loader de `.github/` y los esquemas zod `.strict()` de frontmatter (Anexo A) · Satisface: REQ-VAL-02, REQ-VAL-03
  Hecho cuando: When the spec validator parses a frontmatter, the spec validator shall report `FRONTMATTER_PARSE_ERROR` for invalid YAML and `UNKNOWN_FRONTMATTER_KEY` for a key outside the Annex A set of its file type.
  Verifica: `pnpm -F agent-spec test -- validate.yaml validate.unknown-key`
  Bloqueada por: T-01

- [x] T-18 · Validar los archivos obligatorios y exponer `pnpm spec:validate` (CLI, exit code, salida) · Satisface: REQ-VAL-01, REQ-VAL-05, REQ-VAL-06
  Hecho cuando: If a required `.github/` file listed in Annex D is missing, then the spec validator shall print `REQUIRED_FILE_MISSING` with the file path and exit with code `1`.
  Verifica: `pnpm -F agent-spec test -- validate.required-files validate.exit-code validate.output`
  Bloqueada por: T-17

- [x] T-19 · Crear `scripts/trace.mjs` (tabla de trazabilidad, plantilla de tareas, cobertura MUST) y encadenarlo en `pnpm spec:validate` (design §13) · Satisface: REQ-VAL-07
  Hecho cuando: If a requirement with priority `MUST` in `specs/requirements.md` appears in no task of `specs/tasks.md`, then the spec validator shall report `REQ_WITHOUT_TASK` with the requirement id and exit with code `1`.
  Verifica: `pnpm test -- trace.check` y `node scripts/trace.mjs --write && git diff --exit-code specs/tasks.md`
  Bloqueada por: T-18

- [x] T-20 · Crear el parser de tablas GFM (`tables.ts`) y validar `ticket-lifecycle.instructions.md` (`lifecycle.ts`) · Satisface: REQ-2.1-01, REQ-2.1-02, REQ-2.1-03
  Hecho cuando: When the spec validator loads `ticket-lifecycle.instructions.md`, the spec validator shall report `LIFECYCLE_APPLYTO_MISSING` for a missing `applyTo` glob, `LIFECYCLE_TABLE_INVALID` for a malformed transitions table and `UNKNOWN_STATUS` for a status outside `TicketStatus`.
  Verifica: `pnpm -F agent-spec test -- lifecycle.applyTo lifecycle.table lifecycle.status`
  Bloqueada por: T-18

- [x] T-21 · Validar el frontmatter de `SKILL.md` (nombre, longitud y activación de `description`) · Satisface: REQ-2.2-01, REQ-2.2-02, REQ-2.2-03, REQ-2.2-04
  Hecho cuando: When the spec validator loads a `SKILL.md`, the spec validator shall report one error code per broken rule among `SKILL_FRONTMATTER_INVALID`, `SKILL_NAME_MISMATCH`, `SKILL_DESCRIPTION_TOO_LONG` and `SKILL_ACTIVATION_MISSING`.
  Verifica: `pnpm -F agent-spec test -- skill.frontmatter skill.name skill.description skill.activation`
  Bloqueada por: T-18

- [x] T-22 · Validar el cuerpo de `SKILL.md` (pasos, enlace al script, `Manejo de fallos`, plazo < timeout) · Satisface: REQ-2.2-05, REQ-2.2-06, REQ-2.2-07, REQ-2.2-08
  Hecho cuando: When the spec validator loads a `SKILL.md` body, the spec validator shall report one error code per broken rule among `SKILL_STEPS_MISSING`, `SKILL_RESOURCE_UNLINKED`, `SKILL_FAILURE_SECTION_MISSING` and `SKILL_DEADLINE_INVALID`.
  Verifica: `pnpm -F agent-spec test -- skill.steps skill.resource skill.failure-section skill.timeout`
  Bloqueada por: T-21

- [x] T-23 · Crear `policy.ts` (design §5.2, Anexo B) y validar el frontmatter de los agentes, los campos de handoff y la visibilidad · Satisface: REQ-2.3-01, REQ-2.3-02, REQ-2.3-08
  Hecho cuando: When the spec validator loads the `.agent.md` files, the spec validator shall report one error code per broken rule among `AGENT_FRONTMATTER_INVALID`, `HANDOFF_INVALID` and `AGENT_VISIBILITY_INVALID`.
  Verifica: `pnpm -F agent-spec test -- agents.frontmatter agents.handoff-fields agents.visibility`
  Bloqueada por: T-18

- [x] T-24 · Validar las tools y los handoffs de cada agente contra `policy.ts` y el registry · Satisface: REQ-2.3-07, REQ-2.3-09, REQ-2.3-10
  Hecho cuando: When the spec validator compares the `.agent.md` files with `policy.ts`, the spec validator shall report one error code per broken rule among `HANDOFF_NOT_ALLOWED`, `TOOL_NOT_PERMITTED` and `UNKNOWN_TOOL`.
  Verifica: `pnpm -F agent-spec test -- graph.allowed-handoffs agents.tool-permissions agents.unknown-tool`
  Bloqueada por: T-23

- [x] T-25 · Validar la forma del grafo de handoffs (ciclos, terminal, auto-handoff, destino) · Satisface: REQ-2.3-03, REQ-2.3-04, REQ-2.3-05, REQ-2.3-06
  Hecho cuando: When the spec validator builds the handoff graph, the spec validator shall report one error code per broken rule among `HANDOFF_CYCLE`, `TERMINAL_HAS_HANDOFFS`, `SELF_HANDOFF` and `UNKNOWN_HANDOFF_TARGET`.
  Verifica: `pnpm -F agent-spec test -- graph.acyclic graph.terminal graph.self graph.unknown-target`
  Bloqueada por: T-23

- [x] T-26 · Validar el contexto de los prompts de handoff y las etiquetas de la allowlist · Satisface: REQ-2.3-11, REQ-2.3-33
  Hecho cuando: When the spec validator loads the `.agent.md` files, the spec validator shall report `HANDOFF_CONTEXT_EXCEEDED` for a handoff `prompt` that names a field outside the allowed context and `UNSAFE_ALLOWLIST_ACTION` for an allowlist action tagged `mfa`, `credentials` or `permissions`.
  Verifica: `pnpm -F agent-spec test -- agents.handoff-context allowlist.unsafe`
  Bloqueada por: T-20, T-23

- [x] T-27 · Implementar las reglas R-T1…R-X3 en `routing.ts` (design §2.1) · Satisface: REQ-2.3-21, REQ-2.3-22, REQ-2.3-23, REQ-2.3-24, REQ-2.3-25, REQ-2.3-28, REQ-2.3-29, REQ-2.3-36
  Hecho cuando: When an agent produces a route input, the runtime shall resolve the target agent and the escalation reason from the matching rule of `routing.ts`.
  Verifica: `pnpm -F agent-spec test -- routing.triage routing.diagnostics routing.provisioning`
  Bloqueada por: T-17

- [x] T-28 · Validar que cada ruta es un handoff declarado y que el enrutamiento es determinista · Satisface: REQ-2.3-15, REQ-2.3-16
  Hecho cuando: When the spec validator checks the routing rules, the spec validator shall report `ROUTE_WITHOUT_HANDOFF` for a rule whose target is not a declared handoff of its source agent and `ROUTING_NOT_DETERMINISTIC` for a route input that matches zero rules or more than one rule.
  Verifica: `pnpm -F agent-spec test -- routing.declared routing.deterministic`
  Bloqueada por: T-25, T-27

- [x] T-29 · Validar los prompt files (frontmatter, agente, variables y referencias `#tool:`) · Satisface: REQ-2.4-01, REQ-2.4-02, REQ-2.4-03, REQ-2.4-04, REQ-2.4-05, REQ-2.4-06, REQ-2.4-07
  Hecho cuando: When the spec validator loads the `.prompt.md` files, the spec validator shall report one error code per broken rule among `PROMPT_FRONTMATTER_INVALID`, `UNKNOWN_PROMPT_AGENT`, `PROMPT_VARIABLE_MISSING`, `PROMPT_WITHOUT_TOOL_CALL` and `PROMPT_TOOL_UNDECLARED`.
  Verifica: `pnpm -F agent-spec test -- prompts.frontmatter prompts.agent prompts.variables prompts.tool-call`
  Bloqueada por: T-18

- [x] T-30 · Pasar `pnpm spec:validate` sobre el `.github/` real (test golden) · Satisface: REQ-VAL-04
  Hecho cuando: When the spec validator finds no errors in the real `.github/`, the spec validator shall exit with code `0`.
  Verifica: `pnpm spec:validate` y `pnpm -F agent-spec test -- validate.golden`
  Bloqueada por: T-19, T-20, T-22, T-24, T-26, T-28, T-29

### 2.2 Runtime MUST (`apps/api`)

- [x] T-31 · Crear `apps/api` (NestJS en ESM con `tsc`, vitest; riesgo R-04) con el selector de proveedor en modo test · Satisface: REQ-LLM-04
  Hecho cuando: While `NODE_ENV` is `test`, the runtime shall use the deterministic fake model.
  Verifica: `pnpm -F api build` y `pnpm -F api test -- llm.test-mode`
  Bloqueada por: T-30

- [x] T-32 · Validar la spec al arrancar el api y crear `.env.example` (design §12.5) · Satisface: REQ-API-01
  Hecho cuando: If the `.github/` spec fails validation at startup, then the runtime shall abort startup with the list of validation errors.
  Verifica: `pnpm -F api test -- bootstrap.invalid-spec`
  Bloqueada por: T-31

- [x] T-33 · Arrancar con el modelo fake y un aviso cuando no hay variables de LLM (design §12.3, paso 4) · Satisface: REQ-LLM-03
  Hecho cuando: If no LLM provider variables are set, then the runtime shall start with the deterministic fake model.
  Verifica: `pnpm -F api test -- llm.provider`
  Bloqueada por: T-31

- [x] T-34 · Implementar los patrones 1–7 del redact node (design §8.1) · Satisface: REQ-SEC-01, REQ-SEC-02, REQ-SEC-03, REQ-SEC-04
  Hecho cuando: When ticket text enters the runtime, the redact node shall replace emails with `[EMAIL]`, phone numbers with `[PHONE]`, token-like strings with `[TOKEN]` and credential patterns with `[SECRET]` before any LLM call.
  Verifica: `pnpm -F api test -- redact.email redact.phone redact.token redact.secret`
  Bloqueada por: T-31

- [x] T-35 · Generar el `userRef` opaco con HMAC-SHA256 y `REDACTION_SALT` (design §8.1) · Satisface: REQ-SEC-05
  Hecho cuando: When the redact node finds the identifier of the affected user, the redact node shall store an opaque `userRef` of the form `usr_<hash>` in `entities.userRef`.
  Verifica: `pnpm -F api test -- redact.userref`
  Bloqueada por: T-34

- [x] T-36 · Crear la bitácora JSONL append-only con redacción previa a la escritura (design §8.1, §12.4) · Satisface: REQ-AUD-01, REQ-AUD-02, REQ-SEC-09
  Hecho cuando: When the runtime appends an audit entry, the audit log shall replace every string that matches a redaction pattern with its placeholder and append the entry as one JSON line to `data/audit/<ticketId>.jsonl` without modifying previous lines.
  Verifica: `pnpm -F api test -- audit.append-only audit.jsonl audit.redaction`
  Bloqueada por: T-34

- [x] T-37 · Compilar la máquina de estados desde la tabla de transiciones · Satisface: REQ-2.1-04, REQ-2.1-05, REQ-2.1-10
  Hecho cuando: When the runtime starts, the runtime shall build the ticket state machine from the transitions table in `ticket-lifecycle.instructions.md` and reject with `INVALID_TRANSITION` every transition absent from that table, including every transition from `CLOSED`.
  Verifica: `pnpm -F api test -- lifecycle.compiled lifecycle.invalid lifecycle.closed`
  Bloqueada por: T-32

- [x] T-38 · Evaluar los campos obligatorios y la definición de resuelto en cada transición (design §3.1, predicados) · Satisface: REQ-2.1-06, REQ-2.1-07, REQ-2.1-08, REQ-2.1-09, REQ-COM-01
  Hecho cuando: If a status transition is requested while a required field of its row is empty, then the runtime shall reject the transition with `RESOLUTION_INCOMPLETE` for target `RESOLVED` and with `MISSING_REQUIRED_FIELDS` for any other target.
  Verifica: `pnpm -F api test -- lifecycle.required-fields lifecycle.resolved`
  Bloqueada por: T-37

- [x] T-39 · Crear el ticket store (escritura atómica, regex de `ticketId`) y registrar cada transición en la bitácora · Satisface: REQ-AUD-03
  Hecho cuando: When the runtime applies a status transition, the audit log shall record an entry with `ts`, `agent`, `decision`, `reason`, `from` and `to` in the same step that persists the new ticket state.
  Verifica: `pnpm -F api test -- audit.transition`
  Bloqueada por: T-36, T-38

- [x] T-40 · Compilar la allowlist de remediación y crear el servicio de acciones · Satisface: REQ-2.3-34, REQ-2.3-31, REQ-2.1-11
  Hecho cuando: If an agent requests an action absent from the remediation allowlist compiled from `diagnostics.agent.md`, or the ticket is in `ESCALATED`, then the runtime shall reject the action with the error `ACTION_NOT_ALLOWLISTED`.
  Verifica: `pnpm -F api test -- allowlist.compiled allowlist.reject lifecycle.escalated-no-remediation`
  Bloqueada por: T-37

- [x] T-41 · Compilar el grafo LangGraph desde los `.agent.md` con el registry de tools (design §10, §10.1) · Satisface: REQ-2.3-12, REQ-2.3-13, REQ-2.3-14
  Hecho cuando: When the runtime starts, the runtime shall create one graph node per `.agent.md` file with its body as system prompt and one graph edge per declared handoff.
  Verifica: `pnpm -F api test -- graph.compile graph.system-prompt`
  Bloqueada por: T-31, T-39

- [x] T-42 · Implementar el nodo triage detrás del redact node (salida zod, matriz de severidad, clasificación por palabras clave del `FakeChatModel`, design §12.3) · Satisface: REQ-2.3-18, REQ-2.3-19, REQ-2.3-20
  Hecho cuando: When the triage agent receives a ticket from the redact node, the triage agent shall assign one `category`, extract `entities.service`, `entities.issueType` and `entities.businessImpact` and derive `severity` from the impact × urgency matrix in `triage.agent.md`.
  Verifica: `pnpm -F api test -- triage.category triage.entities triage.severity-matrix`
  Bloqueada por: T-35, T-41

- [x] T-43 · Aplicar `routing.ts` al terminar cada nodo y registrar la decisión · Satisface: REQ-AUD-04
  Hecho cuando: When an agent takes a routing decision, the audit log shall record an entry with the chosen target and the matched rule.
  Verifica: `pnpm -F api test -- audit.routing`
  Bloqueada por: T-27, T-42

- [x] T-44 · Implementar el nodo escalation (paquete, estado `ESCALATED`, fin del recorrido) · Satisface: REQ-ESC-01, REQ-ESC-02, REQ-ESC-03
  Hecho cuando: When the escalation agent completes the escalation package with `ticketId`, `category`, `severity`, `entities`, `findings` and `reason`, the runtime shall set the ticket status to `ESCALATED` and end the graph execution for that ticket.
  Verifica: `pnpm -F api test -- escalation.package escalation.status escalation.terminal`
  Bloqueada por: T-43

- [ ] T-45 · Construir el paquete de escalamiento con la plantilla determinista cuando falla el LLM o el nodo · Satisface: REQ-ESC-06, REQ-ESC-10, REQ-COM-03
  Hecho cuando: If the LLM provider is unavailable or the escalation agent raises an error other than an I/O error, then the escalation agent shall build the escalation package from the deterministic template with the `ticketId` in `userMessage`.
  Verifica: `pnpm -F api test -- escalation.llm-down escalation.fallback escalation.user-message`
  Bloqueada por: T-44

- [ ] T-46 · Derivar `approvalRequest` en el paquete de escalamiento de `provisioning` · Satisface: REQ-ESC-09
  Hecho cuando: While a ticket has category `provisioning`, when the escalation agent builds the escalation package, the escalation agent shall derive `approvalRequest` from `entities.request` and `entities.userRef`.
  Verifica: `pnpm -F api test -- escalation.approval-request`
  Bloqueada por: T-44

- [ ] T-47 · Escalar cuando el LLM de triage falla, tarda más de 30 s o devuelve una salida inválida · Satisface: REQ-ESC-04, REQ-ESC-05
  Hecho cuando: If the LLM call of the triage agent fails, exceeds 30 s or returns output that fails schema validation, then the runtime shall route the ticket to the escalation agent with reason `llm_unavailable` for a failure or timeout and `invalid_llm_output` for a schema failure.
  Verifica: `pnpm -F api test -- llm.failure llm.invalid-output`
  Bloqueada por: T-44

- [ ] T-48 · Pasar solo el contexto permitido en cada handoff (`HandoffEnvelope`, design §4) · Satisface: REQ-2.3-17
  Hecho cuando: When the runtime executes a handoff, the runtime shall pass to the target agent only `ticketId`, `category`, `severity`, `entities` and `findings`.
  Verifica: `pnpm -F api test -- graph.handoff-context`
  Bloqueada por: T-44

- [ ] T-49 · Envolver `check-vpn.js` como tool del registry con el timeout del `SKILL.md` (design §6.3) · Satisface: REQ-2.2-23, REQ-2.2-24, REQ-AUD-05
  Hecho cuando: If the check-vpn process runs longer than the 10 s timeout declared in `SKILL.md`, then the runtime shall terminate the process with `SIGKILL` and append a `tool_run` entry with the tool name, the result status and the duration to the audit log.
  Verifica: `pnpm -F api test -- vpn-tool.run vpn-tool.timeout audit.tool`
  Bloqueada por: T-41

- [ ] T-50 · Convertir el resultado de `check-vpn` en hallazgo o en `skill_resource_unavailable` · Satisface: REQ-2.2-25, REQ-2.2-26, REQ-2.2-27
  Hecho cuando: If the check-vpn tool times out, exits with code `2` or returns invalid JSON, then the runtime shall set `nextAgent` to `escalation` with reason `skill_resource_unavailable` and append an audit entry with that decision, the exit code and the elapsed time.
  Verifica: `pnpm -F api test -- vpn-tool.failure vpn-tool.finding`
  Bloqueada por: T-49

- [ ] T-51 · Implementar la rama VPN del nodo diagnostics (design §2.2) · Satisface: REQ-2.2-09, REQ-2.2-28, REQ-2.2-29
  Hecho cuando: While a ticket has category `infra`, when `entities.issueType` is `vpn`, the diagnostics agent shall apply the `vpn-diagnostics` skill, execute `instruct_vpn_reconnect` on exit code `0` and hand off to the escalation agent with reason `vpn_gateway_unhealthy` on exit code `1`.
  Verifica: `pnpm -F api test -- graph.vpn-route graph.vpn-ok graph.vpn-unhealthy`
  Bloqueada por: T-40, T-48, T-50

- [ ] T-52 · Implementar la rama de bloqueo de cuenta del nodo diagnostics · Satisface: REQ-2.3-27
  Hecho cuando: While a ticket has category `access`, when `entities.issueType` is `lockout`, the diagnostics agent shall execute the allowlisted action `instruct_self_service_unlock`.
  Verifica: `pnpm -F api test -- graph.access-lockout`
  Bloqueada por: T-51

- [ ] T-53 · Pasar a `WAITING_USER` cuando falta el tipo de incidencia · Satisface: REQ-2.3-30
  Hecho cuando: While a ticket has category `infra` or `access`, when `entities.issueType` is `unknown`, the diagnostics agent shall set the ticket to `WAITING_USER` with a `userMessage` that asks for the missing detail.
  Verifica: `pnpm -F api test -- graph.waiting-user`
  Bloqueada por: T-51

- [ ] T-54 · Escalar cuando el runtime rechaza una acción de diagnostics · Satisface: REQ-2.3-32
  Hecho cuando: If the runtime rejects an action with `ACTION_NOT_ALLOWLISTED`, then the diagnostics agent shall hand off to the escalation agent with reason `action_not_allowlisted`.
  Verifica: `pnpm -F api test -- allowlist.escalate`
  Bloqueada por: T-52

- [ ] T-55 · Implementar el nodo provisioning (normalización determinista de `entities.request`) · Satisface: REQ-2.3-35
  Hecho cuando: When the provisioning agent receives a ticket, the provisioning agent shall normalize `entities.request` with `resource`, `accessLevel` and `justification`.
  Verifica: `pnpm -F api test -- provisioning.request`
  Bloqueada por: T-48

- [ ] T-56 · Envolver cada nodo para escalar las excepciones inesperadas · Satisface: REQ-ESC-08
  Hecho cuando: If a node raises an unexpected error, then the runtime shall route the ticket to the escalation agent with reason `internal_error`.
  Verifica: `pnpm -F api test -- graph.internal-error`
  Bloqueada por: T-44

- [ ] T-57 · Detener el recorrido cuando falla la escritura de la bitácora o del ticket store · Satisface: REQ-AUD-06, REQ-AUD-08
  Hecho cuando: If the audit log or the ticket store fails to write, then the runtime shall stop the graph execution for that ticket with the error `AUDIT_WRITE_FAILED` or `STORE_WRITE_FAILED` respectively.
  Verifica: `pnpm -F api test -- audit.write-failure store.write-failure`
  Bloqueada por: T-56

- [ ] T-58 · Aplicar las guardas del `userMessage` (design §8.2) · Satisface: REQ-SEC-10, REQ-COM-02, REQ-COM-04
  Hecho cuando: If a generated `userMessage` asks for a password, a token or an MFA code, contains a term from the jargon list or contains a `userRef` or a JSON fragment, then the runtime shall replace the message with the plain-language template for the ticket outcome and append a `message_replaced` entry to the audit log.
  Verifica: `pnpm -F api test -- guard.credential-request guard.jargon guard.internal-data`
  Bloqueada por: T-45, T-52

- [ ] T-59 · Usar la plantilla cuando el LLM que redacta textos falla o tarda más de 30 s · Satisface: REQ-COM-06
  Hecho cuando: If an LLM call that drafts a `userMessage` or a summary fails or exceeds 30 s, then the runtime shall use the plain-language template for that text.
  Verifica: `pnpm -F api test -- llm.drafting-fallback`
  Bloqueada por: T-58

- [ ] T-60 · Excluir el texto del ticket de los logs y de `data/` (prueba de extremo a extremo con PII sintética) · Satisface: REQ-SEC-07, REQ-SEC-08
  Hecho cuando: When a ticket with synthetic PII completes the graph, the runtime shall leave zero occurrences of the original values in `data/` and in the application logs.
  Verifica: `pnpm -F api test -- redact.persistence redact.logs`
  Bloqueada por: T-53, T-55, T-58

- [ ] T-61 · Exponer `POST /prompts/:name/run` con redacción de variables, render y agente de entrada (design §7) · Satisface: REQ-2.4-11, REQ-2.4-12, REQ-SEC-06
  Hecho cuando: When the api receives `POST /prompts/:name/run`, the runtime shall redact the free-text variables, render the template with them and start the graph at the agent named in the `agent` field of that prompt.
  Verifica: `pnpm -F api test -- prompts.render prompts.entry-agent redact.prompt-variables`
  Bloqueada por: T-51, T-55

- [ ] T-62 · Rechazar prompt runs con variables ausentes, prompt inexistente o ticket inexistente · Satisface: REQ-2.4-13, REQ-2.4-14, REQ-2.4-15
  Hecho cuando: If a `POST /prompts/:name/run` request omits a template variable, names an unknown prompt or references an unknown `ticketId`, then the api shall respond `400` with the missing variable names in the first case and `404` in the other two.
  Verifica: `pnpm -F api test -- prompts.missing-variable prompts.not-found prompts.unknown-ticket`
  Bloqueada por: T-61

- [ ] T-63 · Validar el formato de `target` y la lista `VPN_ALLOWED_TARGETS` en el prompt run · Satisface: REQ-SEC-15, REQ-SEC-14
  Hecho cuando: If a prompt run requests a `target` that does not match `^[a-z0-9.-]+:\d{1,5}$` or that is outside `VPN_ALLOWED_TARGETS`, then the api shall respond `400` before the graph starts.
  Verifica: `pnpm -F api test -- prompts.target-format prompts.target-allowlist`
  Bloqueada por: T-61

### 2.3 Extras SHOULD de la API y del validador

- [ ] T-64 · Calcular `slaDueAt` desde la tabla `## SLA` · Satisface: REQ-2.1-14
  Hecho cuando: When the triage agent assigns a severity, the runtime shall set `slaDueAt` from the SLA table in `ticket-lifecycle.instructions.md`.
  Verifica: `pnpm -F api test -- lifecycle.sla`
  Bloqueada por: T-42

- [ ] T-65 · Exponer `POST /tickets` como alias de `triage-ticket` · Satisface: REQ-API-02, REQ-API-03
  Hecho cuando: When the api receives `POST /tickets`, the api shall respond `202` with the new `ticketId` and start the graph at the redact node.
  Verifica: `pnpm -F api test -- tickets.create`
  Bloqueada por: T-61

- [ ] T-66 · Exponer `GET /tickets`, `GET /tickets/:id` y `GET /tickets/:id/audit` · Satisface: REQ-API-04, REQ-API-05, REQ-API-06
  Hecho cuando: When the api receives `GET /tickets`, `GET /tickets/:id` or `GET /tickets/:id/audit`, the api shall return the ticket summaries with `slaDueAt`, the `TicketState` or the audit entries in write order, respectively.
  Verifica: `pnpm -F api test -- tickets.list tickets.detail tickets.audit`
  Bloqueada por: T-64, T-65

- [ ] T-67 · Exponer `POST /tickets/:id/close` · Satisface: REQ-API-09
  Hecho cuando: When the api receives `POST /tickets/:id/close` for a ticket in `RESOLVED` or `ESCALATED`, the runtime shall set the ticket status to `CLOSED`.
  Verifica: `pnpm -F api test -- tickets.close`
  Bloqueada por: T-66

- [ ] T-68 · Exponer `POST /tickets/:id/reply` y reanudar el grafo en diagnostics · Satisface: REQ-API-08
  Hecho cuando: When the api receives `POST /tickets/:id/reply` with an `issueType` for a ticket in `WAITING_USER`, the runtime shall resume the graph at the diagnostics agent.
  Verifica: `pnpm -F api test -- tickets.reply`
  Bloqueada por: T-53, T-66

- [ ] T-69 · Exponer `GET /health` con el proveedor LLM y el estado de la spec · Satisface: REQ-API-10
  Hecho cuando: When the api receives `GET /health`, the api shall return the active LLM provider and the spec validation status.
  Verifica: `pnpm -F api test -- health`
  Bloqueada por: T-32, T-33

- [ ] T-70 · Validar con zod el body de todas las peticiones · Satisface: REQ-API-11
  Hecho cuando: If a request body fails schema validation, then the api shall respond `400` with the validation errors.
  Verifica: `pnpm -F api test -- validation.body`
  Bloqueada por: T-68

- [ ] T-71 · Asignar `targetTeam` desde la tabla `## Equipos de escalamiento` · Satisface: REQ-ESC-07
  Hecho cuando: When the escalation agent builds the escalation package, the escalation agent shall assign `targetTeam` from the category-to-team table in `escalation.agent.md`.
  Verifica: `pnpm -F api test -- escalation.target-team`
  Bloqueada por: T-44

- [ ] T-72 · Detectar emails reales en `.github/` y en los fixtures · Satisface: REQ-SEC-13
  Hecho cuando: If a file under `.github/` or a test fixture contains an email address outside the domains `example.com` and `example.internal`, then the spec validator shall report `PII_IN_FIXTURE`.
  Verifica: `pnpm -F agent-spec test -- pii.fixtures`
  Bloqueada por: T-30

---

## Fase 3 · SSE y frontend Angular

Gate de entrada: `aprobado fase 2`.

- [ ] T-73 · Exponer `GET /tickets/:id/events` como SSE derivado de la bitácora (design §12.1) · Satisface: REQ-API-07
  Hecho cuando: When a client connects to `GET /tickets/:id/events`, the api shall stream node, handoff and transition events as Server-Sent Events.
  Verifica: `pnpm -F api test -- tickets.sse`
  Bloqueada por: T-66

- [ ] T-74 · Crear `apps/web` (Angular CLI, componentes standalone, signals, runner de tests) con la ruta raíz y un test de humo · Satisface: REQ-WEB-08
  Hecho cuando: When the operator opens the root path `/`, the web app shall redirect to the inbox view `/tickets`.
  Verifica: `pnpm -F web build` y `pnpm -F web test -- app.smoke`
  Bloqueada por: T-01

- [ ] T-75 · Crear `ApiService` (`HttpClient`) y la vista de bandeja · Satisface: REQ-WEB-01
  Hecho cuando: When the operator opens the inbox view, the web app shall list tickets with `ticketId`, `category`, `severity`, `status` and SLA.
  Verifica: `pnpm -F web test -- inbox`
  Bloqueada por: T-66, T-74

- [ ] T-76 · Crear el detalle del ticket con el timeline del grafo · Satisface: REQ-WEB-02
  Hecho cuando: When the operator opens a ticket, the web app shall display a timeline with visited nodes, handoffs, decisions and durations.
  Verifica: `pnpm -F web test -- timeline`
  Bloqueada por: T-75

- [ ] T-77 · Crear la pestaña de bitácora del ticket · Satisface: REQ-WEB-03
  Hecho cuando: When the operator opens the audit view of a ticket, the web app shall display the audit entries in write order.
  Verifica: `pnpm -F web test -- audit-view`
  Bloqueada por: T-76

- [ ] T-78 · Mostrar solo `redactedText` en el detalle del ticket · Satisface: REQ-WEB-06
  Hecho cuando: The web app shall display only the redacted ticket text.
  Verifica: `pnpm -F web test -- redacted-only`
  Bloqueada por: T-76

- [ ] T-79 · Añadir al timeline los eventos SSE en vivo (`EventsService`) · Satisface: REQ-WEB-04
  Hecho cuando: While a ticket graph is running, the web app shall append the events received over SSE to the timeline without a page reload.
  Verifica: `pnpm -F web test -- timeline.sse`
  Bloqueada por: T-73, T-76

- [ ] T-80 · Reintentar la conexión SSE cada 5 s · Satisface: REQ-WEB-05
  Hecho cuando: If the SSE connection drops, then the web app shall retry the connection every 5 s.
  Verifica: `pnpm -F web test -- timeline.reconnect`
  Bloqueada por: T-79

- [ ] T-81 · Crear el formulario de nuevo ticket · Satisface: REQ-WEB-07
  Hecho cuando: When the operator submits the new-ticket form, the web app shall send the text to `POST /prompts/triage-ticket/run`.
  Verifica: `pnpm -F web test -- new-ticket`
  Bloqueada por: T-75

---

## Fase 4 · Azure, CI y documentación

Gate de entrada: `aprobado fase 3`.

- [ ] T-82 · Usar `AzureChatOpenAI` cuando existen las variables de Azure OpenAI · Satisface: REQ-LLM-01
  Hecho cuando: Where `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_DEPLOYMENT` are set, the runtime shall use `AzureChatOpenAI` as the LLM provider.
  Verifica: `pnpm -F api test -- llm.provider` (variables sintéticas, sin red)
  Bloqueada por: T-33

- [ ] T-83 · Usar `ChatAnthropic` cuando solo existe `ANTHROPIC_API_KEY` · Satisface: REQ-LLM-02
  Hecho cuando: Where the Azure OpenAI variables are absent and `ANTHROPIC_API_KEY` is set, the runtime shall use `ChatAnthropic` as the LLM provider.
  Verifica: `pnpm -F api test -- llm.provider` (variables sintéticas, sin red)
  Bloqueada por: T-82

- [ ] T-84 · Crear `azure-pipelines.yml` (design §12.6) · Satisface: REQ-CI-01, REQ-CI-02, REQ-CI-03
  Hecho cuando: When a commit is pushed, the ci pipeline shall run `pnpm spec:validate`, `pnpm lint` and `pnpm test`.
  Verifica: `pnpm test -- ci.pipeline` (parsea `azure-pipelines.yml` con `yaml` y comprueba los tres pasos) + ejecución verde en Azure DevOps. Como `spec:validate` incluye `trace.mjs --check` (T-19), el pipeline falla si una MUST queda sin tarea
  Bloqueada por: T-30

- [ ] T-85 · Fijar el umbral de cobertura del 90 % en `packages/agent-spec` · Satisface: REQ-CI-04
  Hecho cuando: If the line coverage of `packages/agent-spec` is below 90 %, then the ci pipeline shall fail the build.
  Verifica: `pnpm -F agent-spec test -- --coverage` (umbral en `vitest.config.ts`; bajarlo a 100 % hace fallar el comando)
  Bloqueada por: T-84

- [ ] T-86 · Generar el diagrama Mermaid del grafo con `pnpm spec:graph` y escribir el README con el guion de demo · Satisface: REQ-DOC-01
  Hecho cuando: When `pnpm spec:graph` runs, the spec validator shall print a Mermaid flowchart of the compiled handoff graph.
  Verifica: `pnpm -F agent-spec test -- docs.readme-graph` (la salida coincide con el diagrama incrustado en `README.md`)
  Bloqueada por: T-30

---

## Decisiones de la revisión (v0.1 → v0.2)

| ID | Pregunta | Resolución |
| --- | --- | --- |
| Q-01 | El README de la Fase 4 no tenía `REQ`. | ✅ Alta de **REQ-DOC-01 (SHOULD)** en `requirements.md` §13; la cubre T-86. |
| Q-02 | REQ-SEC-12 pedía un test de runtime sin diseño. | ✅ **D-10:** solo modo Copilot en v1 (T-08); se quitó `triage.exposed-credential` de su `Verifica`. |
| Q-03 | ¿`.vscode/settings.json` con auto-aprobación (R-05)? | ✅ **D-11:** no. La confirmación manual de cada ejecución es la guarda frente a la inyección de comandos en modo Copilot. |

---

## Trazabilidad REQ → tareas

<!-- TRACE:START -->
Cobertura: **136/136 MUST** y **33/33 SHOULD** con al menos una tarea. 86 tareas.

| REQ | Prioridad | Tareas |
| --- | --- | --- |
| REQ-2.1-01 | MUST | T-20 |
| REQ-2.1-02 | MUST | T-20 |
| REQ-2.1-03 | MUST | T-20 |
| REQ-2.1-04 | MUST | T-37 |
| REQ-2.1-05 | MUST | T-37 |
| REQ-2.1-06 | MUST | T-38 |
| REQ-2.1-07 | MUST | T-38 |
| REQ-2.1-08 | MUST | T-38 |
| REQ-2.1-09 | MUST | T-38 |
| REQ-2.1-10 | MUST | T-37 |
| REQ-2.1-11 | MUST | T-40 |
| REQ-2.1-12 | MUST | T-09 |
| REQ-2.1-13 | MUST | T-10 |
| REQ-2.1-14 | SHOULD | T-64 |
| REQ-2.2-01 | MUST | T-21 |
| REQ-2.2-02 | MUST | T-21 |
| REQ-2.2-03 | MUST | T-21 |
| REQ-2.2-04 | MUST | T-21 |
| REQ-2.2-05 | MUST | T-22 |
| REQ-2.2-06 | MUST | T-22 |
| REQ-2.2-07 | MUST | T-22 |
| REQ-2.2-08 | MUST | T-22 |
| REQ-2.2-09 | MUST | T-14, T-51 |
| REQ-2.2-10 | MUST | T-03 |
| REQ-2.2-11 | MUST | T-03 |
| REQ-2.2-12 | MUST | T-03 |
| REQ-2.2-13 | MUST | T-04 |
| REQ-2.2-14 | MUST | T-05 |
| REQ-2.2-15 | MUST | T-05 |
| REQ-2.2-16 | MUST | T-06 |
| REQ-2.2-17 | MUST | T-03 |
| REQ-2.2-18 | MUST | T-04 |
| REQ-2.2-19 | MUST | T-02 |
| REQ-2.2-20 | MUST | T-06 |
| REQ-2.2-21 | MUST | T-02 |
| REQ-2.2-22 | MUST | T-01 |
| REQ-2.2-23 | MUST | T-49 |
| REQ-2.2-24 | MUST | T-49 |
| REQ-2.2-25 | MUST | T-50 |
| REQ-2.2-26 | MUST | T-50 |
| REQ-2.2-27 | MUST | T-50 |
| REQ-2.2-28 | MUST | T-51 |
| REQ-2.2-29 | MUST | T-51 |
| REQ-2.2-30 | MUST | T-16 |
| REQ-2.3-01 | MUST | T-23 |
| REQ-2.3-02 | MUST | T-23 |
| REQ-2.3-03 | MUST | T-25 |
| REQ-2.3-04 | MUST | T-25 |
| REQ-2.3-05 | MUST | T-25 |
| REQ-2.3-06 | MUST | T-25 |
| REQ-2.3-07 | MUST | T-24 |
| REQ-2.3-08 | MUST | T-23 |
| REQ-2.3-09 | MUST | T-24 |
| REQ-2.3-10 | MUST | T-24 |
| REQ-2.3-11 | MUST | T-26 |
| REQ-2.3-12 | MUST | T-41 |
| REQ-2.3-13 | MUST | T-41 |
| REQ-2.3-14 | MUST | T-41 |
| REQ-2.3-15 | MUST | T-28 |
| REQ-2.3-16 | MUST | T-28 |
| REQ-2.3-17 | MUST | T-48 |
| REQ-2.3-18 | MUST | T-42 |
| REQ-2.3-19 | MUST | T-42 |
| REQ-2.3-20 | MUST | T-42 |
| REQ-2.3-21 | MUST | T-27 |
| REQ-2.3-22 | MUST | T-27 |
| REQ-2.3-23 | MUST | T-27 |
| REQ-2.3-24 | MUST | T-27 |
| REQ-2.3-25 | MUST | T-27 |
| REQ-2.3-26 | MUST | T-07 |
| REQ-2.3-27 | MUST | T-13, T-52 |
| REQ-2.3-28 | MUST | T-27 |
| REQ-2.3-29 | MUST | T-27 |
| REQ-2.3-30 | MUST | T-53 |
| REQ-2.3-31 | MUST | T-40 |
| REQ-2.3-32 | MUST | T-54 |
| REQ-2.3-33 | MUST | T-26 |
| REQ-2.3-34 | MUST | T-40 |
| REQ-2.3-35 | MUST | T-55 |
| REQ-2.3-36 | MUST | T-12, T-27 |
| REQ-2.4-01 | MUST | T-29 |
| REQ-2.4-02 | MUST | T-29 |
| REQ-2.4-03 | MUST | T-29 |
| REQ-2.4-04 | MUST | T-29 |
| REQ-2.4-05 | MUST | T-29 |
| REQ-2.4-06 | MUST | T-29 |
| REQ-2.4-07 | MUST | T-29 |
| REQ-2.4-08 | MUST | T-09 |
| REQ-2.4-09 | MUST | T-14 |
| REQ-2.4-10 | MUST | T-11 |
| REQ-2.4-11 | MUST | T-61 |
| REQ-2.4-12 | MUST | T-61 |
| REQ-2.4-13 | MUST | T-62 |
| REQ-2.4-14 | MUST | T-62 |
| REQ-2.4-15 | MUST | T-62 |
| REQ-SEC-01 | MUST | T-34 |
| REQ-SEC-02 | MUST | T-34 |
| REQ-SEC-03 | MUST | T-34 |
| REQ-SEC-04 | MUST | T-34 |
| REQ-SEC-05 | MUST | T-35 |
| REQ-SEC-06 | MUST | T-61 |
| REQ-SEC-07 | MUST | T-60 |
| REQ-SEC-08 | MUST | T-60 |
| REQ-SEC-09 | MUST | T-36 |
| REQ-SEC-10 | MUST | T-58 |
| REQ-SEC-11 | MUST | T-08 |
| REQ-SEC-12 | SHOULD | T-08 |
| REQ-SEC-13 | SHOULD | T-72 |
| REQ-SEC-14 | SHOULD | T-63 |
| REQ-SEC-15 | MUST | T-15, T-63 |
| REQ-AUD-01 | MUST | T-36 |
| REQ-AUD-02 | MUST | T-36 |
| REQ-AUD-03 | MUST | T-39 |
| REQ-AUD-04 | MUST | T-43 |
| REQ-AUD-05 | MUST | T-49 |
| REQ-AUD-06 | MUST | T-57 |
| REQ-AUD-07 | MUST | T-09 |
| REQ-AUD-08 | MUST | T-57 |
| REQ-ESC-01 | MUST | T-44 |
| REQ-ESC-02 | MUST | T-44 |
| REQ-ESC-03 | MUST | T-44 |
| REQ-ESC-04 | MUST | T-47 |
| REQ-ESC-05 | MUST | T-47 |
| REQ-ESC-06 | MUST | T-45 |
| REQ-ESC-07 | SHOULD | T-71 |
| REQ-ESC-08 | MUST | T-56 |
| REQ-ESC-09 | MUST | T-46 |
| REQ-ESC-10 | MUST | T-45 |
| REQ-COM-01 | MUST | T-38 |
| REQ-COM-02 | MUST | T-58 |
| REQ-COM-03 | MUST | T-45 |
| REQ-COM-04 | SHOULD | T-58 |
| REQ-COM-05 | MUST | T-14 |
| REQ-COM-06 | MUST | T-59 |
| REQ-API-01 | MUST | T-32 |
| REQ-API-02 | SHOULD | T-65 |
| REQ-API-03 | SHOULD | T-65 |
| REQ-API-04 | SHOULD | T-66 |
| REQ-API-05 | SHOULD | T-66 |
| REQ-API-06 | SHOULD | T-66 |
| REQ-API-07 | SHOULD | T-73 |
| REQ-API-08 | SHOULD | T-68 |
| REQ-API-09 | SHOULD | T-67 |
| REQ-API-10 | SHOULD | T-69 |
| REQ-API-11 | SHOULD | T-70 |
| REQ-LLM-01 | SHOULD | T-82 |
| REQ-LLM-02 | SHOULD | T-83 |
| REQ-LLM-03 | SHOULD | T-33 |
| REQ-LLM-04 | MUST | T-31 |
| REQ-WEB-01 | SHOULD | T-75 |
| REQ-WEB-02 | SHOULD | T-76 |
| REQ-WEB-03 | SHOULD | T-77 |
| REQ-WEB-04 | SHOULD | T-79 |
| REQ-WEB-05 | SHOULD | T-80 |
| REQ-WEB-06 | SHOULD | T-78 |
| REQ-WEB-07 | SHOULD | T-81 |
| REQ-WEB-08 | SHOULD | T-74 |
| REQ-VAL-01 | MUST | T-18 |
| REQ-VAL-02 | MUST | T-17 |
| REQ-VAL-03 | MUST | T-17 |
| REQ-VAL-04 | MUST | T-30 |
| REQ-VAL-05 | MUST | T-18 |
| REQ-VAL-06 | MUST | T-18 |
| REQ-VAL-07 | SHOULD | T-19 |
| REQ-CI-01 | SHOULD | T-84 |
| REQ-CI-02 | SHOULD | T-84 |
| REQ-CI-03 | SHOULD | T-84 |
| REQ-CI-04 | SHOULD | T-85 |
| REQ-DOC-01 | SHOULD | T-86 |
<!-- TRACE:END -->

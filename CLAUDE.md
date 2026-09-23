# CLAUDE.md — Harness SDD · Ecosistema de Agentes Help Desk

> Lee este archivo completo antes de tocar cualquier cosa. Es el contrato de trabajo entre el humano (Jaider) y tú.
> Si algo aquí contradice a `specs/`, gana `specs/` (y avísalo). Si `specs/` no existe todavía, tu única tarea es la Fase 0.

---

## 0. Protocolo de trabajo (Spec Driven Development)

La fuente de verdad del proyecto vive en `specs/`. **No implementes nada que no esté en `specs/tasks.md`.**

### Ciclo por sesión

1. Lee `specs/requirements.md`, `specs/design.md`, `specs/tasks.md` y `specs/changelog.md` (si existen).
2. Toma la **primera** tarea `[ ]` de `tasks.md` que no esté bloqueada. Anúnciala en una línea: `▶ T-xx: <título>`.
3. Implementa **solo esa tarea**. Nada "por si acaso", nada de refactors no pedidos.
4. Ejecuta la verificación declarada en la tarea (línea `Verifica:`). Si falla, arregla antes de seguir.
5. Marca `[x]`, añade una línea a `specs/changelog.md`: `YYYY-MM-DD · T-xx · qué se verificó`.
6. Repite. Máximo 5 tareas por sesión sin pausar a reportar.

### Detente y pregunta (no asumas) cuando

- Vas a cambiar una decisión registrada en `specs/design.md`.
- Un criterio de aceptación es ambiguo o no es verificable.
- Vas a añadir una dependencia no listada en la sección 6.
- Necesitas un secreto, endpoint real o dato que no está en `.env.example`.

### Reglas duras (no negociables)

- **Gates de fase:** no pasas de una fase a la siguiente sin el mensaje literal del humano: `aprobado fase N`.
- **`.github/` es la especificación ejecutable del producto.** El runtime la *lee y compila*; nunca duplica a mano lo que ya está en los `.md`.
- **Cero secretos ni PII** en código, fixtures, tests, logs, commits ni ejemplos. Usa datos sintéticos obvios (`usr_a1b2`, `vpn-gw.example.internal`).
- **Handoffs deterministas y acíclicos.** El grafo es un DAG. `escalation` es terminal. Un test lo verifica.
- **Todo lo que hace un agente queda en bitácora** (`AuditEntry`). Sin bitácora no hay tarea terminada.
- Commits pequeños, convencionales: `feat(spec): ...`, `feat(api): ...`, `test(graph): ...`, `docs: ...`.
- Idioma: código, identificadores y commits en inglés; `specs/`, `.github/*.md`, README y mensajes al usuario final en español.

---

## 1. Contexto y objetivo

Prueba técnica para una vacante Full Stack + IA + Azure (Node.js, Angular, LangGraph/Agent Framework, Azure DevOps, Copilot/Claude Code).

**Qué se califica:** los cuatro componentes de la sección 2 de la prueba, implementados "según las buenas prácticas y estándares de la plataforma" (VS Code / Copilot agent customization). **Todo lo demás es plus.**

**Estrategia para impresionar:**

- Los artefactos `.github/` funcionan **de verdad** desde Copilot Chat en VS Code (esto solo ya aprueba).
- Un runtime Node.js con **LangGraph.js** que *compila* esos mismos `.md` en un grafo ejecutable expuesto por API.
- Un frontend **Angular** que muestra la bandeja de tickets, el recorrido por el grafo (handoffs) y la bitácora auditable.
- Azure OpenAI como proveedor LLM por variable de entorno + `azure-pipelines.yml`.
- Este mismo repo demuestra SDD con Claude Code (este archivo + `specs/`).

---

## 2. Fuente de verdad: la prueba técnica

### 2.0 Caso de negocio (resumen)

Mesa de soporte que recibe incidencias en lenguaje natural, con información incompleta, urgencia variable y SLA. Tres tipologías:

| Categoría                                     | Ejemplos                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `access` — Acceso e identidad                 | bloqueo por reintentos, reseteo de contraseña, MFA, cuenta deshabilitada por inactividad |
| `infra` — Infraestructura y software local    | VPN, degradación de rendimiento, apps corporativas                                       |
| `provisioning` — Aprovisionamiento y permisos | altas a carpetas/repos, licencias, cambios de perfil                                     |

Capacidades esperadas: clasificación y triage (categoría, severidad, entidades: usuario afectado, servicio, criticidad de negocio); diagnóstico y auto-remediación **solo si es determinístico y seguro**; seguridad (no pedir/almacenar/divulgar credenciales, tokens, secretos ni PII en texto plano); escalamiento con bitácora auditable de cada decisión; comunicación clara al usuario final sin jerga.

### 2.1 Custom Instructions — `.github/instructions/ticket-lifecycle.instructions.md`

Instrucciones dedicadas al ciclo de vida del ticket: transiciones de estado permitidas, campos obligatorios en cada cambio y condiciones para considerar un caso resuelto.

**Criterios de aceptación**
- Archivo con frontmatter `applyTo` apuntando al código de tickets (p. ej. `"**/tickets/**"`).
- Tabla explícita de transiciones `desde → hacia` con campos obligatorios por transición.
- Definición de "resuelto" verificable (diagnóstico OK + acción segura ejecutada o instrucción entregada + mensaje al usuario + entrada de bitácora).
- El runtime implementa **la misma** máquina de estados y rechaza transiciones inválidas (test).

### 2.2 Agent Skills — `.github/skills/vpn-diagnostics/`

Al menos una habilidad procedimental paso a paso para diagnóstico técnico, con un script auxiliar funcional que se consume durante el procedimiento, criterios de activación claros y manejo explícito de fallo si el recurso auxiliar no responde.

**Criterios de aceptación**
- `SKILL.md` con frontmatter (`name`, `description` que actúe como criterio de activación) y cuerpo con pasos numerados.
- `scripts/check-vpn.js` (Node, sin dependencias externas) que ejecute comprobaciones reales y parametrizables: resolución DNS del gateway, conectividad TCP a `host:port`, latencia. Salida JSON estable `{ ok, checks: [...], summary }`. Exit codes: `0` ok, `1` fallo diagnosticado, `2` error del script/timeout.
- Sección "Manejo de fallos" en `SKILL.md`: timeout de 10 s, qué registrar en bitácora, y handoff a `escalation` con motivo `skill_resource_unavailable`.
- El runtime envuelve el script como tool con el mismo timeout y la misma política de fallo (test con script forzado a fallar).

### 2.3 Custom Agents & Handoffs — `.github/agents/*.agent.md`

Al menos dos agentes especializados con roles delimitados; herramientas por agente, permisos de delegación y handoffs configurados explícitamente; handoffs deterministas, sin ciclos ni bloqueos, transfiriendo solo el contexto estrictamente necesario.

**Agentes definidos (no cambiar sin aprobación)**

| Agente         | Rol                                                                                     | `user-invocable` | Handoffs permitidos                               |
| -------------- | --------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------- |
| `triage`       | Clasifica, estima severidad, extrae entidades, redacta PII                              | `true`           | → `diagnostics`, → `provisioning`, → `escalation` |
| `diagnostics`  | Ejecuta skills de diagnóstico y acciones seguras (allowlist) para `infra` y `access`    | `false`          | → `escalation`                                    |
| `provisioning` | Estructura solicitudes de acceso/licencia; nunca concede, genera petición de aprobación | `false`          | → `escalation`                                    |
| `escalation`   | Empaqueta el caso para humano/otro equipo, cierra el recorrido                          | `false`          | ninguno (terminal)                                |

**Criterios de aceptación**
- Cada `.agent.md` declara `description`, `tools` (lista mínima necesaria) y `handoffs` con `label`, `agent`, `prompt`, `send`.
- Cada handoff lleva en `prompt` **solo** el contexto necesario (`ticketId`, `category`, `severity`, `entities`, `findings`), nunca el texto crudo del usuario.
- Test que carga los frontmatters y verifica: grafo acíclico, `escalation` sin salidas, ningún agente se referencia a sí mismo.
- Acciones de auto-remediación limitadas a una allowlist documentada; cualquier cosa que toque MFA, credenciales o permisos → `escalation`.

### 2.4 Prompt Files — `.github/prompts/*.prompt.md`

Plantillas ejecutables y parametrizables para que un operador dispare flujos bajo demanda, con variables dinámicas e invocación de herramientas.

**Criterios de aceptación**
- Mínimo tres: `triage-ticket.prompt.md` (`${input:ticket}`, `${input:channel}`), `run-vpn-diagnostics.prompt.md` (`${input:ticketId}`, `${input:target}`), `escalate-ticket.prompt.md` (`${input:ticketId}`, `${input:reason}`).
- Frontmatter con `agent` destino y `tools`; cuerpo que invoque herramientas explícitamente.
- El runtime expone `POST /prompts/:name/run` que renderiza la plantilla con las variables y dispara el grafo desde el agente indicado.

> Antes de escribir cualquier frontmatter, consulta la doc oficial vigente de VS Code (agent customization: custom agents, skills, prompt files, instructions) y respeta sus campos exactos. No inventes claves. Si necesitas metadatos propios, van en archivos aparte (ver 3.3).

---

## 3. Arquitectura decidida (registrar como ADRs en `design.md`; no reabrir sin aprobación)

### 3.1 Estructura del repo

```
helpdesk-agents/
├── .github/
│   ├── copilot-instructions.md               # reglas globales: PII, tono, idioma, sin jerga
│   ├── instructions/ticket-lifecycle.instructions.md
│   ├── skills/vpn-diagnostics/{SKILL.md, scripts/check-vpn.js}
│   ├── agents/{triage,diagnostics,provisioning,escalation}.agent.md
│   └── prompts/{triage-ticket,run-vpn-diagnostics,escalate-ticket}.prompt.md
├── apps/
│   ├── api/                # NestJS + @langchain/langgraph · carga .github/ y compila el grafo
│   └── web/                # Angular (standalone, signals) · bandeja, timeline, bitácora
├── packages/
│   └── agent-spec/         # parser de frontmatter + routing + validación (el "compilador")
├── specs/                  # requirements.md · design.md · tasks.md · changelog.md
├── docs/                   # prueba-tecnica.md (texto original), diagramas
├── AGENTS.md -> CLAUDE.md  # symlink para Copilot/otros agentes
├── azure-pipelines.yml
└── README.md
```

### 3.2 Runtime = compilador de la spec

- `packages/agent-spec` parsea `.github/agents/*.agent.md`, `skills/*/SKILL.md`, `prompts/*.prompt.md` y `instructions/*.instructions.md` (frontmatter YAML + cuerpo).
- Cada `.agent.md` → un nodo de `StateGraph`. Su cuerpo → system prompt. Su `tools` → tools reales resueltas por nombre desde un registry (nombre desconocido = error al arrancar).
- `handoffs` → edges permitidos del DAG. Las **condiciones** de enrutamiento viven en `packages/agent-spec/src/routing.ts`; al arrancar se valida que cada ruta exista como handoff declarado. Así el `.md` sigue siendo el estándar de VS Code sin claves inventadas.
- `pnpm spec:validate` corre esa validación completa (frontmatters, DAG, tools, variables de prompts). Es parte de CI.

### 3.3 Contrato de estado del grafo (punto de partida; refinar en `design.md`)

```ts
type TicketStatus = 'NEW' | 'TRIAGED' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';

interface TicketState {
  ticketId: string;
  redactedText: string;          // lo único que ve el LLM y se persiste
  category?: 'access' | 'infra' | 'provisioning' | 'unknown';
  severity?: 'P1' | 'P2' | 'P3' | 'P4';
  entities?: { userRef: string; service?: string; businessImpact?: 'low' | 'medium' | 'high' };
  findings: DiagnosticFinding[];
  actions: ExecutedAction[];     // solo acciones de la allowlist
  status: TicketStatus;
  audit: AuditEntry[];           // append-only: { ts, agent, decision, reason, from, to }
  nextAgent?: 'diagnostics' | 'provisioning' | 'escalation';
  userMessage?: string;          // respuesta final orientada al usuario, sin jerga
}
```

- `rawText` nunca entra al estado: se redacta en un nodo `redact` antes de `triage` (emails, teléfonos, tokens/JWT, patrones `password: ...`). El usuario afectado se guarda como `userRef` opaco (`usr_<hash>`).
- Ciclo de vida inicial: `NEW → TRIAGED → IN_PROGRESS → (RESOLVED | ESCALATED | WAITING_USER) → CLOSED`. La tabla completa de transiciones y campos obligatorios se fija en 2.1 y `design.md`.
- Bitácora persistida como JSONL append-only en `data/audit/<ticketId>.jsonl` (sin base de datos en v1).

### 3.4 Frontend

Angular (última estable, componentes standalone, signals). Tres vistas: bandeja de tickets, detalle con timeline del grafo (nodos visitados, handoffs, decisiones, tiempos) y bitácora. Streaming vía SSE (`GET /tickets/:id/events`). Sin librerías de estado externas.

### 3.5 LLM

`@langchain/openai` con `AzureChatOpenAI` cuando existan `AZURE_OPENAI_*`; fallback a `@langchain/anthropic` con `ANTHROPIC_API_KEY`. Nunca instanciar un cliente sin variables; los tests usan un modelo fake/determinista.

---

## 4. Fases y gates

| Fase  | Entregable                                                                                         | Gate              |
| ----- | -------------------------------------------------------------------------------------------------- | ----------------- |
| **0** | `specs/requirements.md`, `specs/design.md`, `specs/tasks.md`, `specs/changelog.md`                 | `aprobado fase 0` |
| **1** | `.github/` completo y probado manualmente desde Copilot Chat en VS Code                            | `aprobado fase 1` |
| **2** | `packages/agent-spec` + grafo LangGraph + API NestJS + `spec:validate` en verde                    | `aprobado fase 2` |
| **3** | Angular: bandeja, timeline, bitácora, SSE                                                          | `aprobado fase 3` |
| **4** | Azure OpenAI por env, `azure-pipelines.yml`, README con diagrama Mermaid del grafo y guion de demo | fin               |

Cada fase termina con un reporte de 5 líneas máximo: qué se hizo, cómo se verificó, qué quedó pendiente, riesgos, siguiente paso.

---

## 5. Fase 0 — cómo generar `specs/` (tu primera tarea)

Genera los cuatro archivos en este orden. Presenta cada uno y **espera aprobación antes del siguiente**.

### Sintaxis obligatoria: EARS (Easy Approach to Requirements Syntax)

Referencia: https://alistairmavin.com/ears/ · Todo requisito y todo criterio de aceptación de tarea se escribe en EARS. Sin excepciones.

**Estructura genérica** (las cláusulas siempre en este orden):

`While <precondición(es)>, when <disparador>, the <sistema> shall <respuesta>`

Reglas: cero o muchas precondiciones · cero o un disparador · exactamente un nombre de sistema · una o muchas respuestas.

**Patrones permitidos**

| Patrón                    | Forma                                                              | Ejemplo en este dominio                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ubicuo                    | `The <sistema> shall <respuesta>`                                  | The audit log shall be append-only.                                                                                                                                      |
| Dirigido por estado       | `While <precondición>, the <sistema> shall <respuesta>`            | While a ticket is in `ESCALATED`, the runtime shall reject any automated remediation action.                                                                             |
| Dirigido por evento       | `When <disparador>, the <sistema> shall <respuesta>`               | When a ticket is created, the `redact` node shall replace emails, phone numbers and token-like strings before any LLM call.                                              |
| Opcional                  | `Where <característica presente>, the <sistema> shall <respuesta>` | Where `AZURE_OPENAI_ENDPOINT` is set, the api shall use `AzureChatOpenAI` as the LLM provider.                                                                           |
| Comportamiento no deseado | `If <disparador>, then the <sistema> shall <respuesta>`            | If `check-vpn.js` does not respond within 10 s, then the `diagnostics` agent shall log `skill_resource_unavailable` and hand off to `escalation`.                        |
| Complejo                  | Combinación de los anteriores, mismo orden de cláusulas            | While a ticket is in `TRIAGED`, when `category` is `infra`, the `triage` agent shall hand off to `diagnostics` with only `ticketId`, `category`, `severity`, `entities`. |

**Nombres de sistema válidos** (usa exactamente estos): `the triage agent`, `the diagnostics agent`, `the provisioning agent`, `the escalation agent`, `the redact node`, `the runtime`, `the api`, `the web app`, `the spec validator`, `the check-vpn script`, `the audit log`.

Prohibido: "should", "may", "must", "will", voz pasiva sin sistema, adverbios vagos (`quickly`, `properly`, `appropriately`), dos comportamientos en un solo `shall` unidos por "and/or" ambiguo.

### `specs/requirements.md`

- Un requisito por bloque, **una sola sentencia EARS** por requisito. Si necesitas "y", son dos requisitos.
- IDs trazables a la prueba: `REQ-2.1-01`, `REQ-2.2-03`, `REQ-SEC-02`, `REQ-COM-01`.
- Debajo de cada requisito: `Patrón: <Ubicuo|Estado|Evento|Opcional|No deseado|Complejo>` y `Verifica: <comando, test o inspección concreta>`.
- Cubre: 2.1, 2.2, 2.3, 2.4, seguridad/PII, escalamiento/bitácora, comunicación al usuario, runtime (API), frontend, CI.
- Marca prioridad: `MUST` (lo que califica la prueba) / `SHOULD` (plus).
- Todo comportamiento de fallo (timeouts, LLM caído, transición inválida, tool desconocida) va obligatoriamente en patrón **If/Then**.

### `specs/design.md`

- Arquitectura y diagrama Mermaid del grafo (nodos, edges, condiciones).
- Máquina de estados del ticket (tabla de transiciones + campos obligatorios).
- Contrato `TicketState` final, `AuditEntry`, `DiagnosticFinding`, `ExecutedAction`.
- Política de PII/redacción y allowlist de auto-remediación.
- Mapeo `.github/` → runtime (qué campo del frontmatter alimenta qué).
- Manejo de errores (timeout de skill, LLM caído, transición inválida).
- ADRs cortos: ADR-01 spec como fuente de verdad, ADR-02 routing fuera del `.md`, ADR-03 JSONL en lugar de DB, ADR-04 proveedor LLM por env.

### `specs/tasks.md`

Agrupadas por fase. Cada tarea sigue **exactamente** esta plantilla:

```markdown
- [ ] T-xx · <título imperativo corto> · Satisface: REQ-…, REQ-…
  Hecho cuando: <una sentencia EARS que describe el comportamiento observable al terminar>
  Verifica: <comando o test que demuestra la sentencia anterior>
  Bloqueada por: <T-yy | ninguna>
```

Ejemplo:

```markdown
- [ ] T-07 · Envolver check-vpn.js como tool con timeout · Satisface: REQ-2.2-03, REQ-2.2-04
  Hecho cuando: If the check-vpn script exceeds 10 s, then the runtime shall abort the process, append `skill_resource_unavailable` to the audit log and set `nextAgent` to `escalation`.
  Verifica: pnpm -F api test -- vpn-tool.timeout
  Bloqueada por: T-05
```

- `Hecho cuando` es una sentencia EARS válida (ver patrones arriba); si no puedes escribirla, la tarea está mal definida — divídela o pregunta.
- Tamaño máximo ~1 h de trabajo; si es más grande, divídela.
- Orden: primero lo que califica (Fase 1), luego lo que impresiona.
- Toda `REQ` con prioridad `MUST` debe aparecer en al menos una tarea; genera al final una tabla de trazabilidad `REQ → tareas`.

### `specs/changelog.md`

Solo el encabezado y la primera línea con la fecha de creación de las specs.

---

## 6. Convenciones técnicas

- Node LTS actual, `pnpm` workspaces, TypeScript `strict: true`, ESM.
- Tests: `vitest` (unit + integración del grafo con LLM fake). Cobertura mínima del paquete `agent-spec`: 90 %.
- Lint/format: ESLint + Prettier con la configuración por defecto del monorepo.
- Dependencias permitidas sin preguntar: `@langchain/langgraph`, `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`, `@nestjs/*`, `zod`, `gray-matter`, `yaml`, `vitest`, Angular CLI y sus paquetes. Cualquier otra → pregunta.
- `.env.example` siempre actualizado; `.env` en `.gitignore`.
- El script de la skill (`check-vpn.js`) no usa dependencias: solo `node:dns`, `node:net`, `node:perf_hooks`.

## 7. Comandos

```bash
pnpm install
pnpm spec:validate          # valida .github/ (frontmatters, DAG, tools, prompts)
pnpm test                   # todo el monorepo
pnpm -F api dev             # http://localhost:3000
pnpm -F web start           # http://localhost:4200
node .github/skills/vpn-diagnostics/scripts/check-vpn.js --target vpn-gw.example.internal:443
```

## 8. Definición de terminado (global)

Una tarea está terminada solo si: su `Verifica:` pasa, no introduce secretos ni PII, deja bitácora cuando aplica, está marcada `[x]` y tiene línea en `changelog.md`. Una fase está terminada solo si el humano escribió `aprobado fase N`.

---

## 9. Primera instrucción

Si `specs/` no existe: ejecuta la Fase 0 empezando por `specs/requirements.md`. No crees ningún otro archivo del proyecto hasta recibir `aprobado fase 0`.
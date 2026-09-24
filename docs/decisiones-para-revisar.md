# Decisiones tomadas por Claude para revisar

Registro de las decisiones que Claude tomó por Jaider sin su aprobación explícita, para revisarlas después. Cada entrada dice qué se decidió, por qué, cómo revertirlo y en qué commit está.

**Cómo revisar:** marca cada fila en la columna «Revisión» con ✅ (se queda) o ❌ (revertir, con una nota). Las entradas nuevas se añaden al final de su fase.

---

## Abiertas: esperan tu decisión

| ID | Pregunta | Estado |
| --- | --- | --- |
| DA-01 | Proveedor LLM de la Fase 4: la spec dice Azure OpenAI → Anthropic → fake (ADR-04, REQ-LLM-01/02). Mencionaste DeepSeek (créditos pagos, sin OpenAI) y LM Studio local. Cambiarlo toca ADR-04, REQ-LLM-01/02 y T-82/T-83. | Sin decidir. Se plantea al llegar a T-82; hasta entonces los tests usan el modelo fake. |

## Fase 1 · `check-vpn.js` y `.github/`

| ID | Decisión | Por qué | Cómo revertir | Commit | Revisión |
| --- | --- | --- | --- | --- | --- |
| DC-01 | Ramas: `feat/phase-1-github` sale de `docs/phase-0-specs` y `feat/phase-2-runtime` sale de la de Fase 1. Nada se ha subido ni fusionado. | Una rama por fase, sin tocar `main`. | Fusionar o rebasar como prefieras. | — | |
| DC-02 | TypeScript 6.0 en lugar de 7.0. | `typescript-eslint` solo admite TypeScript < 6.1. | Subir cuando `typescript-eslint` soporte 7. | `47a691b` | |
| DC-03 | `vite` entra como peer automático de `vitest` 5, sin declararlo. | `vitest` 5 lo exige como peer. | Declararlo explícito en `package.json`. | `47a691b` | |
| DC-04 | `CLAUDE.md` pasa de symlink roto (apuntaba a sí mismo) a archivo normal. | `AGENTS.md -> CLAUDE.md` no resolvía. | `git revert` del cambio de tipo. | `47a691b` | |
| DC-05 | Prettier con `singleQuote` y `printWidth: 100`; los `.md`, `specs/` y `docs/` quedan fuera de Prettier. | Coincide con el estilo de Angular y no reformatea las tablas de las specs. | Editar `.prettierrc.json` y `.prettierignore`. | `47a691b` | |
| DC-06 | `check-vpn.js` valida más de lo pedido: argumentos desconocidos, puerto 1–65535 y valores numéricos. | Evitar ejecuciones con argumentos ambiguos. | Quitar las validaciones extra de `parseArgs`. | `0c2fa6e` | |
| DC-07 | La latencia se informa como `durationMs` del check `latency`, redondeada hacia arriba a 0,1 ms. | El esquema de `checks` no tiene campo `latencyMs`; redondear hacia arriba mantiene exacta la comparación con el umbral. | Añadir `latencyMs` al esquema de salida. | `f9e4c9f`, `bb003c2` | |
| DC-08 | El script sale en cuanto vacía stdout (`process.exit`). | Una búsqueda DNS vencida no se puede cancelar y dejaba el proceso vivo hasta que el runtime lo mataba. | Volver a `process.exitCode`. | `157ef98` | |
| DC-09 | `--deadline-ms` tiene un máximo de 9000; el plazo por defecto se prueba leyendo el código y con un plazo reducido, sin un test de 9 s. | La spec pide probar el plazo con un argumento reducido; un test de 9 s ralentiza la suite. | Añadir un test de 9 s. | `120cd3f` | |
| DC-10 | Los tests de timeout toleran 1 ms. | Los timers de Node usan un reloj de milisegundos enteros y disparan hasta 1 ms antes. | Ninguno necesario. | `72fe0d7` | |
| DC-11 | En Copilot, un ticket VPN que llega por handoff se diagnostica contra `vpn-gw.example.internal:443`, que nunca resuelve y termina escalado. | No hay variables de entorno en modo Copilot. | Cambiar el objetivo por defecto en `SKILL.md`. | `23b6ba3` | |
| DC-12 | Un `target` rechazado se registra como `error` con `reason: invalid_target`, sin copiar el valor. | No propagar texto potencialmente malicioso a la bitácora. | Editar el paso 3 de `SKILL.md`. | `053f05b` | |
| DC-13 | El sufijo del `ticketId` en Copilot sale de las iniciales de las tres primeras palabras del texto redactado. | El modelo repetía siempre el mismo sufijo y los tickets se habrían sobrescrito. | Editar el paso 7 de `triage.agent.md`. | `78f1add` | |
| DC-14 | Reglas endurecidas tras las pruebas manuales: una transición por petición y solo por su responsable, nunca inventar datos, escribir solo en `data/`, la terminal solo para el comando de la skill, una entrada de bitácora por línea y el `id` de la acción igual al de la allowlist. | Cada una corrige un fallo real observado en M-01, M-02, M-03, M-05 o M-08. | Editar los `.md` afectados. | `78f1add`, `5d22a27`, `c4f7787`, `23ababc` | |
| DC-15 | Las pruebas manuales las ejecutó Claude con `code chat`, capturas y clics simulados; aprobó el comando exacto de la skill (con `cd` a la raíz delante) y omitió los demás comandos. | Pediste «hazlo tú». | Repetir las pruebas a mano con `docs/manual-tests.md`. | `64718fc`, `9cd817e` | |
| DC-16 | Se reparó la bitácora de prueba del ticket B (una línea pegada) y se borraron archivos basura que creó Copilot. | Datos de prueba en `data/`, fuera de git. | Ninguno necesario. | — | |
| DC-17 | M-09 se dio por buena con el panel Problems sin avisos y las tools ejecutadas, sin abrir el diálogo Configure Tools. | El diálogo solo se abre con clics; la evidencia equivalente estaba disponible. | Abrir Configure Tools en cada agente. | `9cd817e` | |

## Fase 2 · `packages/agent-spec` y validador

| ID | Decisión | Por qué | Cómo revertir | Commit | Revisión |
| --- | --- | --- | --- | --- | --- |
| DC-18 | `pnpm spec:validate` ejecuta el TypeScript de `agent-spec` directamente con Node (type stripping): imports con `.ts`, solo sintaxis borrable y `engines.node >= 22.18`. | Sin paso de build para las herramientas de spec. | Compilar `agent-spec` con `tsc` y ejecutar `dist/`. | `9211e14` | |
| DC-19 | El frontmatter se lee con `gray-matter` usando el parser `yaml` (YAML 1.2). | Rechaza claves duplicadas y evita rarezas de YAML 1.1. | Usar el motor por defecto de `gray-matter`. | `e34e42e` | |
| DC-20 | `trace.mjs --check` informa además `TASK_TEMPLATE_INVALID`, `UNKNOWN_REQ` y `TRACE_TABLE_OUTDATED`. | El título de T-19 pide vigilar la plantilla de tareas y la tabla. | Quitar esos tres chequeos. | `a484d91` | |
| DC-21 | Ciclo de vida: `applyTo` tiene que incluir literalmente `**/tickets/**` (se admite una lista con comas); una celda de campos vacía o un campo fuera de `TicketState` dan `LIFECYCLE_TABLE_INVALID`. | Lectura literal de REQ-2.1-01 y design §3.1. | Ajustar `lifecycle.ts`. | `c0c4224` | |
| DC-22 | Las reglas de la skill aplican a todos los archivos de `scripts/`: cada uno tiene que estar enlazado y definir `DEFAULT_DEADLINE_MS` menor que el timeout. Un procedimiento necesita al menos 2 pasos numerados. | Generalizar la regla de `check-vpn.js` a cualquier script de skill. | Limitarlas a `check-vpn.js` en `skill.ts`. | `1732a5c` | |
| DC-23 | Un agente fuera de `policy.ts` da `AGENT_VISIBILITY_INVALID`; la visibilidad compara `user-invocable` y `disable-model-invocation`. | Con D-12 las dos claves forman la visibilidad. | Ajustar `agents.ts`. | `29ef621` | |
| DC-24 | Una tool fuera del registry da solo `UNKNOWN_TOOL`, no también `TOOL_NOT_PERMITTED`. | Evitar dos errores por la misma causa. | Ajustar `agents.ts`. | `cc829d7` | |
| DC-25 | Un auto-handoff da solo `SELF_HANDOFF`, no también `HANDOFF_CYCLE`; el agente terminal es el que `policy.ts` deja sin handoffs. | Evitar dos errores por la misma causa. | Ajustar `graph.ts`. | `fec31ad` | |
| DC-26 | Contexto de handoff: solo cuentan los tokens entre comillas invertidas cuya raíz es una clave de `TicketState`. | Lectura de design §5.4. | Ajustar `agents.ts`. | `8a43140` | |
| DC-27 | `R-X3` son tres reglas con el mismo id (una por agente); `ROUTE_WITHOUT_HANDOFF` señala el `.agent.md` origen y `ROUTING_NOT_DETERMINISTIC` señala `routing.ts`. | La interfaz `RouteRule` de design §2.1 tiene un solo `from`. | Cambiar `from` a una lista. | `3a41ae9`, `feb8715` | |
| DC-28 | Los fixtures de test quedan fuera de ESLint. | Son datos, no código (por ejemplo, scripts con constantes sin usar). | Quitar `**/test/fixtures/` de `eslint.config.js`. | `1732a5c` | |
| DC-29 | El test golden fija además el resultado compilado (4 agentes, 5 handoffs, 12 transiciones, allowlist, timeout y variables). | Que «golden» detecte cambios de estructura, no solo errores. | Dejar solo la comprobación de cero errores. | `df45723` | |
| DC-30 | NestJS se añade con sus dependencias obligatorias `reflect-metadata` y `rxjs`, que no están en la lista de §6. | NestJS no arranca sin ellas; delegaste la decisión. | Ninguno práctico: sin ellas no hay NestJS. | T-31 | |
| DC-31 | NestJS 12, que ya es ESM nativo; el api compila con `tsc` y Vitest emite los metadatos de decoradores sin el plugin SWC. | Resuelve el riesgo R-04 sin dependencias extra; se comprobó arrancando `dist/main.js`. | Ninguno necesario. | T-31 | |
| DC-32 | Hasta T-33, el api solo arranca con `NODE_ENV=test`; en otro entorno falla con «No LLM provider is configured» en lugar de usar el modelo fake en silencio. | T-33 añade ese fallback con su aviso; no adelantar comportamiento sin test. | Resuelta en T-33: ahora arranca con el modelo fake y un aviso. | T-31, T-33 | |
| DC-33 | El api consume `agent-spec` así: `tsc -b` compila `agent-spec` a `dist/` por referencia de proyecto; Node usa ese `dist/`; Vitest y el editor leen el código fuente con la condición de export `source`. | `agent-spec` usa imports `.ts` (DC-18) y el api compila con `tsc`; así ninguno de los dos cambia su forma de trabajar. | Publicar `agent-spec` solo compilado y ajustar los imports. | T-32 | |
| DC-34 | La raíz de la spec es la raíz del repositorio por defecto; los tests pasan otra raíz con `SpecModule.forRoot({ root })`. No hay variable `SPEC_ROOT`. | Design §12.5 no define esa variable. | Añadir `SPEC_ROOT` a `.env.example`. | T-32 | |
| DC-35 | El patrón del documento de identidad se aplica antes que el del teléfono (design §8.1 los pone al revés). | Con el orden del diseño, «cédula 1020304050» salía como `[PHONE]`. | Invertir el orden en `patterns.ts`. | T-34 | |
| DC-36 | El patrón 7 acepta también «usuario es <nombre>», y ni `userRef` ni «usuario está» cuentan como usuario. | Con el patrón literal, el ticket F de M-07 («Mi usuario es ana.demo») no se redactaba. | Volver a la expresión literal de design §8.1. | T-34 | |
| DC-37 | Repo `jaider012/helpdesk-agents` creado **privado**, con las 4 ramas subidas. `main` sigue en el commit inicial: el trabajo más reciente está en `feat/phase-2-runtime`. Antes de subir se revisó el historial: sin tokens, sin claves privadas, sin correos reales y sin `.env`. `docs/prueba-tecnica.pdf` y `docs/use-cases.md` no se subieron porque nunca se añadieron a git. | Privado por defecto hasta que decidas compartirlo con quien evalúa la prueba; no fusionar nada a `main` sin tu revisión. | `gh repo edit jaider012/helpdesk-agents --visibility public --accept-visibility-change-consequences` y fusionar ramas a `main` cuando quieras. | — | |
| DC-38 | La bitácora redacta cada valor de texto de la entrada, no el JSON serializado; los números y las claves no se tocan. El `ticketId` se valida con su formato antes de construir cualquier ruta. | Pasar los patrones sobre el JSON crudo podía romperlo (un número largo leído como teléfono). La validación evita el path traversal ya en la bitácora. | Redactar la línea serializada en `audit-log.ts`. | T-36 | |
| DC-39 | Al aplicar una transición: primero se valida, después se escribe la entrada de bitácora y por último se guarda el ticket. Una transición rechazada deja una entrada `transition_rejected` con su código. | «Sin bitácora no hay cambio de estado» (UC-SYS-09): si falla la bitácora, el estado no cambia. El caso inverso (bitácora escrita y ticket sin guardar) lo cubre `STORE_WRITE_FAILED` en T-57. | Invertir el orden en `ticket-lifecycle.ts`. | T-39 | |
| DC-40 | `ExecutedAction.id` es un `string` (design §4 lo fija a los dos ids actuales). | La allowlist compilada de `diagnostics.agent.md` es la fuente de verdad (ADR-01): una fila nueva no debe exigir cambiar el tipo. | Volver a la unión de ids en `ticket-state.ts`. | T-40 | |
| DC-41 | `DATA_DIR` se resuelve contra la raíz del repositorio (por defecto `data/`), no contra la carpeta desde la que arranca el api. | `pnpm -F api dev` arranca en `apps/api`; así el api y el modo Copilot comparten los mismos tickets y bitácora. | Resolverlo contra `process.cwd()` en `paths.ts`. | T-40 | |
| DC-42 | En el estado del grafo, `TicketState.escalation` se llama `escalationPackage`; al guardar el ticket vuelve a llamarse `escalation`. | LangGraph no permite un canal con el mismo nombre que un nodo, y `escalation` es a la vez agente y campo (lo usa la tabla de transiciones). | Renombrar el nodo en lugar del campo. | T-41 | |
| DC-43 | Hasta que cada nodo tenga su comportamiento (T-42 en adelante), el grafo compilado usa nodos que no cambian el estado. | T-41 solo compila la estructura del grafo. | Se resuelve nodo a nodo en las tareas siguientes. | T-41 | |
| DC-44 | El texto crudo entra al grafo en un canal transitorio `rawText`, que el redact node vacía; no forma parte de `TicketState` ni se guarda. | Design §2 pone el redact node dentro del grafo y §8.1 prohíbe guardar el texto crudo. | Redactar en la petición HTTP, antes de invocar el grafo. | T-42 | |
| DC-45 | El `FakeChatModel` implementa `bindTools` y responde con un `AIMessageChunk` que lleva la llamada a la tool; el nodo triage valida él mismo los argumentos con zod. | El `withStructuredOutput` base de `@langchain/core` solo acepta chunks y no valida el esquema. | Ninguno práctico. | T-42 | |
| DC-46 | Reglas del modelo fake: además de las palabras clave de design §12.3, «nadie», «todos», «sede» o «detenid…» dan impacto y urgencia `high`; provisioning da impacto `low`; el resto, `medium`. | Design §12.3 no fija impacto ni urgencia, y los tests necesitan casos P1 y P4 deterministas. | Ajustar `fake-responder.ts`. | T-42 | |
| DC-47 | Los motivos (`reason`) que escribe el runtime en la bitácora van en inglés; los del modo Copilot van en español. | Son texto técnico generado por código (código en inglés, CLAUDE.md §0). | Traducirlos en el código si la bitácora se va a mostrar tal cual. | T-36 a T-42 | |
| DC-48 | El nodo triage aplica `NEW → TRIAGED` (T1) al clasificar con éxito; el nodo escalation toma el motivo de la decisión de enrutamiento o, si llega sin ella (prompt `escalate-ticket`), usa `operator_request`. | Es el camino del diagrama de design §3 y permite a escalation hacer `TRIAGED → ESCALATED` (T4). Ninguna tarea asignaba T1 explícitamente. | Mover T1 a otro punto del grafo. | T-44 | |
| DC-49 | Escalation pide al LLM el resumen y el mensaje con una sola salida estructurada (`draft_escalation`), mandándole solo el contexto del handoff. Si el LLM falla o su salida no cumple el esquema → plantillas y `message_replaced`; si el mensaje no trae el `ticketId` → plantilla solo para el mensaje. Cualquier error del nodo que no sea de escritura (I/O) → paquete completo desde las plantillas y el ticket igual queda `ESCALATED`. | Design §5.1 y §11 (ESC-06, ESC-10, COM-03). | Ajustar `escalation.node.ts`. | T-45 | |
| DC-50 | El modelo fake recibe las plantillas de la spec (a través de `LlmModule`, con `SPEC_BUNDLE` opcional) para responder los borradores con exactamente la plantilla. | Design §9: «El fake model devuelve exactamente la plantilla». | Ninguno práctico. | T-45 | |

## Aprobadas explícitamente por ti (referencia)

- Dependencias de tooling de T-01: `typescript-eslint`, `@eslint/js`, `globals`, `eslint-config-prettier`, `@types/node`.
- D-12 · plan B de R-02: los tres agentes destino con `user-invocable: true` y `disable-model-invocation: true`.
- Ejecutar yo las pruebas manuales de la Fase 1 («hazlo tú»).

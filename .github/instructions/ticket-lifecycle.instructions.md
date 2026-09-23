---
name: ticket-lifecycle
description: Ciclo de vida de un ticket de soporte. Transiciones de estado permitidas, campos obligatorios por transición, definición de resuelto, SLA y formato de los archivos del ticket y de la bitácora.
applyTo: '**/tickets/**'
---

# Ciclo de vida del ticket

Estas reglas aplican cada vez que se crea o se modifica un ticket (`data/tickets/<ticketId>.json`) y al código de tickets (`apps/api/src/tickets/**`).

## Reglas

1. Un ticket solo cambia de estado por una fila de la [Tabla de transiciones](#tabla-de-transiciones). Cualquier otro cambio de estado se rechaza.
2. Si alguien pide una transición que no está en la tabla, recházala y cita las transiciones permitidas desde el estado actual. Ejemplo: desde `TRIAGED` solo se permite pasar a `IN_PROGRESS` o a `ESCALATED`.
3. Antes de aplicar una transición, comprueba sus campos obligatorios. Si falta alguno, no la apliques y di cuál falta.
4. `CLOSED` es un estado final: desde `CLOSED` no hay ninguna transición.
5. Mientras el ticket está en `ESCALATED`, no se ejecuta ninguna acción de remediación.
6. Cada transición aplicada añade en el mismo paso una entrada `transition` a la bitácora con `ts`, `agent`, `decision`, `reason`, `from` y `to`. Si no puedes escribir la bitácora, no cambies el estado.

## Tabla de transiciones

| # | desde | hacia | campos obligatorios | responsable |
| --- | --- | --- | --- | --- |
| T1 | `NEW` | `TRIAGED` | `category`, `severity`, `entities.userRef`, `entities.issueType` | triage |
| T2 | `NEW` | `ESCALATED` | `escalation.reason`, `userMessage` | escalation |
| T3 | `TRIAGED` | `IN_PROGRESS` | `nextAgent` | diagnostics / provisioning |
| T4 | `TRIAGED` | `ESCALATED` | `escalation.reason`, `userMessage` | escalation |
| T5 | `IN_PROGRESS` | `RESOLVED` | `findings[conclusive]`, `actions[allowlisted]`, `userMessage` | diagnostics |
| T6 | `IN_PROGRESS` | `WAITING_USER` | `userMessage` | diagnostics |
| T7 | `IN_PROGRESS` | `ESCALATED` | `escalation.reason`, `userMessage` | escalation |
| T8 | `WAITING_USER` | `IN_PROGRESS` | `entities.issueType!=unknown` | runtime (respuesta del usuario) |
| T9 | `WAITING_USER` | `ESCALATED` | `escalation.reason`, `userMessage` | escalation |
| T10 | `WAITING_USER` | `CLOSED` | `closeReason` | runtime (operador) |
| T11 | `RESOLVED` | `CLOSED` | `closeReason` | runtime (operador) |
| T12 | `ESCALATED` | `CLOSED` | `closeReason` | runtime (operador) |

Cómo se leen los campos obligatorios (separados por comas):

- `ruta.al.campo`: el campo existe y no está vacío (un texto distinto de `''`, una lista con elementos).
- `ruta!=valor`: el campo existe y es distinto de `valor`.
- `lista[flag]`: la lista tiene al menos un elemento con `flag` igual a `true`.

## Definición de resuelto

Un ticket pasa a `RESOLVED` solo si se cumplen las cuatro condiciones:

1. **Diagnóstico concluyente:** al menos un hallazgo de `findings` con `conclusive: true`, es decir, el recurso respondió e identificó la causa.
2. **Acción segura:** al menos una acción de `actions` con `allowlisted: true`. Una instrucción entregada al usuario cuenta como acción.
3. **Mensaje al usuario:** `userMessage` no está vacío y está en lenguaje llano.
4. **Bitácora:** la transición `IN_PROGRESS → RESOLVED` queda registrada en la bitácora en el mismo paso.

## SLA

| severidad | objetivo de resolución |
| --- | --- |
| P1 | 4 h |
| P2 | 8 h |
| P3 | 24 h |
| P4 | 72 h |

`slaDueAt` = `createdAt` + objetivo de resolución de la severidad.

## Archivos del ticket

### `data/tickets/<ticketId>.json`

El estado actual del ticket. Ejemplo sintético justo después de triage:

```json
{
  "ticketId": "TCK-20260923-101500-a1b",
  "channel": "email",
  "createdAt": "2026-09-23T10:15:00Z",
  "redactedText": "Desde esta mañana la VPN no me conecta. Mi correo es [EMAIL].",
  "category": "infra",
  "severity": "P3",
  "urgency": "medium",
  "entities": {
    "userRef": "usr_a1b2c3d4",
    "service": "VPN corporativa",
    "issueType": "vpn",
    "businessImpact": "medium"
  },
  "findings": [],
  "actions": [],
  "status": "TRIAGED",
  "entryAgent": "triage",
  "nextAgent": "diagnostics",
  "slaDueAt": "2026-09-24T10:15:00Z"
}
```

- `ticketId`: `TCK-AAAAMMDD-HHMMSS-xxx`, donde `xxx` son 3 caracteres en minúsculas de `0-9` y `a-z`.
- `redactedText` es lo único que se guarda del texto del usuario, siempre redactado.
- `category`: `access`, `infra`, `provisioning` o `unknown`. `severity`: `P1` a `P4`. `urgency` y `entities.businessImpact`: `low`, `medium` o `high`.
- `entities.issueType`: `lockout`, `password_reset`, `mfa`, `disabled_account` (access) · `vpn`, `performance`, `app` (infra) · `folder_access`, `repo_access`, `license`, `profile_change` (provisioning) · `unknown`.
- `entities.request` (solo provisioning): `{ "resource", "accessLevel": "read" | "write" | "admin" | "license", "justification" }`.
- `findings[]`: `{ "id": "fnd_<n>", "source": "check-vpn" | "rule", "conclusive", "cause", "checks", "exitCode", "summary", "durationMs", "ts" }`.
- `actions[]`: `{ "id", "kind": "instruction" | "automated", "allowlisted": true, "agent", "result": "delivered" | "succeeded" | "failed", "ts" }`.
- `escalation` (solo al escalar): `{ "ticketId", "category", "severity", "entities", "findings", "reason", "targetTeam", "approvalRequest", "summary", "createdAt" }`.
- `userMessage`: el mensaje para el usuario final. `closeReason`: `user_confirmed`, `no_user_reply` o `handled_by_team`.

### `data/audit/<ticketId>.jsonl`

La bitácora del ticket: una línea JSON por entrada, en orden de escritura. Ejemplo sintético de dos líneas:

```jsonl
{"ts":"2026-09-23T10:15:00Z","ticketId":"TCK-20260923-101500-a1b","seq":1,"agent":"triage","decision":"ticket_created","reason":"ticket recibido por email","to":"NEW","data":{"redacted":{"EMAIL":1}}}
{"ts":"2026-09-23T10:15:02Z","ticketId":"TCK-20260923-101500-a1b","seq":2,"agent":"triage","decision":"transition","reason":"clasificado como infra/vpn con severidad P3","from":"NEW","to":"TRIAGED"}
```

- Campos: `ts` (ISO 8601), `ticketId`, `seq` (empieza en 1 y sube de uno en uno), `agent` (`triage`, `diagnostics`, `provisioning`, `escalation`, `redact`, `runtime` u `operator`), `decision`, `reason`, y opcionalmente `from`, `to` y `data`.
- `decision`: `ticket_created`, `redacted`, `prompt_run`, `node_started`, `node_finished`, `classified`, `routed`, `transition`, `transition_rejected`, `tool_run`, `skill_resource_unavailable`, `action_executed`, `action_rejected`, `message_replaced`, `escalated`, `llm_unavailable`, `invalid_llm_output` o `error`.
- `from` y `to` son estados en una entrada `transition` y agentes en una entrada `routed`.
- `data` solo lleva identificadores, códigos, duraciones y conteos. Nunca texto del ticket ni datos personales.
- Solo se añaden líneas al final del archivo. Nunca se modifica ni se borra una línea existente.

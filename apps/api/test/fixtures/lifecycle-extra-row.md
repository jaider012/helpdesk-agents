# Ciclo de vida con una fila extra

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
| T13 | `RESOLVED` | `IN_PROGRESS` | `userMessage` | runtime (reapertura) |

Cómo se leen los campos obligatorios (separados por comas):

- `ruta.al.campo`: el campo existe y no está vacío (un texto distinto de `''`, una lista con elementos).
- `ruta!=valor`: el campo existe y es distinto de `valor`.
- `lista[flag]`: la lista tiene al menos un elemento con `flag` igual a `true`.

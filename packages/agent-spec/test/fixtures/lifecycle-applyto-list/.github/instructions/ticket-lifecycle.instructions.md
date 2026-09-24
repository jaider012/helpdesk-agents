---
applyTo: '**/*.ts, **/tickets/**'
---

# Ciclo de vida

## Tabla de transiciones

| # | desde | hacia | campos obligatorios | responsable |
| --- | --- | --- | --- | --- |
| T1 | `NEW` | `TRIAGED` | `category`, `severity`, `entities.userRef`, `entities.issueType` | triage |
| T3 | `TRIAGED` | `IN_PROGRESS` | `nextAgent` | diagnostics |
| T5 | `IN_PROGRESS` | `RESOLVED` | `findings[conclusive]`, `actions[allowlisted]`, `userMessage` | diagnostics |
| T8 | `WAITING_USER` | `IN_PROGRESS` | `entities.issueType!=unknown` | runtime |

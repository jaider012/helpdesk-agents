---
description: Escala un ticket existente a un equipo humano con el paquete de escalamiento y lo pasa a ESCALATED.
argument-hint: 'ticketId: TCK-AAAAMMDD-HHMMSS-xxx · reason: motivo del escalamiento'
agent: escalation
tools: ['read/readFile', 'edit/editFiles']
---

Escala el ticket ${input:ticketId} a petición del operador.

Motivo indicado por el operador (redáctalo antes de usarlo; si no es uno de los códigos de motivo, usa `operator_request`):

${input:reason}

1. Lee `data/tickets/<ticketId>.json` con #tool:read/readFile. Si no existe, dilo y no crees nada.
2. Comprueba que su estado tiene transición a `ESCALATED`. Si no la tiene, no lo cambies y cita las transiciones permitidas desde su estado.
3. Construye el paquete de escalamiento con `ticketId`, `category`, `severity`, `entities`, `findings`, `reason`, `targetTeam` y, si la categoría es `provisioning`, `approvalRequest`.
4. Guarda el paquete, `userMessage` y el estado `ESCALATED` en el ticket, y añade al final de `data/audit/<ticketId>.jsonl` las entradas `escalated` y `transition`, todo con #tool:edit/editFiles.
5. Responde con el equipo destino, el motivo, el paquete y el mensaje para el usuario.

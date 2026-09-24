---
name: triage
description: Clasifica tickets.
tools: ['read/readFile']
handoffs:
  - label: Diagnosticar
    agent: diagnostics
    prompt: 'Diagnostica usando `ticketId`, `entities.issueType` y `redactedText`. Revisa el `Resumen de triage`.'
    send: true
  - label: Escalar
    agent: escalation
    prompt: 'Escala usando `ticketId` y `userMessage`.'
    send: true
---

Cuerpo.

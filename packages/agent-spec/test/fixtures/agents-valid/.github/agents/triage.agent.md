---
name: triage
description: Clasifica tickets.
tools: ['read/readFile', 'edit/createFile', 'edit/editFiles']
user-invocable: true
handoffs:
  - label: Escalar
    agent: escalation
    prompt: 'Escala usando solo `ticketId`.'
    send: true
---

Cuerpo.

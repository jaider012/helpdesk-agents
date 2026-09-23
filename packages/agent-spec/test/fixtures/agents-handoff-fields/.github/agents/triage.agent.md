---
name: triage
description: Clasifica tickets.
tools: ['read/readFile']
handoffs:
  - label: Diagnosticar
    agent: diagnostics
    prompt: Diagnostica.
  - label: Escalar
    agent: escalation
    send: true
  - Escalar ya
---

Cuerpo.

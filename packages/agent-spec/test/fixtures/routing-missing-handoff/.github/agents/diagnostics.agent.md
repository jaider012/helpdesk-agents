---
name: diagnostics
description: Agente de prueba.
tools: ['read/readFile']
handoffs:
  - label: Ir a escalation
    agent: escalation
    prompt: Continúa.
    send: true
---

Cuerpo.

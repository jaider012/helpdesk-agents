---
name: triage
description: Agente de prueba.
tools: ['read/readFile']
handoffs:
  - label: Ir a diagnostics
    agent: diagnostics
    prompt: Continúa.
    send: true
  - label: Ir a escalation
    agent: escalation
    prompt: Continúa.
    send: true
---

Cuerpo.

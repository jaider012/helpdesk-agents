---
name: triage
description: Agente de prueba.
tools: ['read/readFile']
infer: true
color: blue
handoffs:
  - label: Escalar
    agent: escalation
    prompt: Escala el caso.
    send: true
    condition: always
---

Cuerpo.

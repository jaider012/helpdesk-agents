---
name: triage
description: Agente de prueba.
tools: ['read/readFile']
handoffs:
  - label: Ir a reviewer
    agent: reviewer
    prompt: Continúa.
    send: true
---

Cuerpo.

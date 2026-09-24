---
name: diagnostics
description: Diagnostica.
tools: ['read/readFile', 'edit/editFiles', 'execute/runInTerminal']
user-invocable: true
disable-model-invocation: true
handoffs:
  - label: Escalar
    agent: escalation
    prompt: Escala.
    send: true
  - label: Aprovisionar
    agent: provisioning
    prompt: Aprovisiona.
    send: true
---

Cuerpo.

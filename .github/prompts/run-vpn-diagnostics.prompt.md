---
description: Ejecuta el diagnóstico de VPN (skill vpn-diagnostics) sobre un host:puerto para un ticket existente.
argument-hint: 'ticketId: TCK-AAAAMMDD-HHMMSS-xxx · target: host:puerto'
agent: diagnostics
tools: ['read/readFile', 'edit/editFiles', 'execute/runInTerminal']
---

Diagnostica la conexión VPN del ticket ${input:ticketId} contra el objetivo `${input:target:host:puerto}`, siguiendo la skill [vpn-diagnostics](../skills/vpn-diagnostics/SKILL.md).

1. Lee `data/tickets/<ticketId>.json` con #tool:read/readFile. Si no existe, dilo y no ejecutes nada. Si su estado no es `TRIAGED`, `IN_PROGRESS` ni `WAITING_USER`, no ejecutes nada y cita las transiciones permitidas desde su estado.
2. Aplica el procedimiento de la skill sobre el objetivo indicado: ejecuta `scripts/check-vpn.js` con #tool:execute/runInTerminal e interpreta el resultado como indica la skill.
3. Registra el hallazgo, la acción o el motivo de escalamiento en el ticket y en la bitácora con #tool:edit/editFiles.
4. Responde con el resultado para el operador y el mensaje para el usuario en español llano, sin términos de la lista de jerga.

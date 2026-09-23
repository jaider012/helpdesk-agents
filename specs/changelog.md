# Changelog

2026-09-23 · Fase 0 · specs creadas: `requirements.md` v0.4 (136 MUST, 33 SHOULD), `design.md` v0.3 y `tasks.md` v0.3 (86 tareas); un script comprobó que 136/136 MUST y 33/33 SHOULD tienen al menos una tarea
2026-09-23 · Gate · `aprobado fase 0` recibido; `requirements.md` v0.4, `design.md` v0.3 y `tasks.md` v0.3 pasan a estado aprobado
2026-09-23 · T-01 · `pnpm test -- check-vpn.imports` (2/2, incluido un test del detector de imports) y `pnpm lint` (ESLint + Prettier) en verde; `CLAUDE.md` pasa de symlink roto a archivo para que resuelva `AGENTS.md -> CLAUDE.md`; deps de tooling aprobadas por el humano: `typescript-eslint`, `@eslint/js`, `globals`, `eslint-config-prettier`, `@types/node` (TypeScript 6.0, límite del peer de `typescript-eslint`)
2026-09-23 · T-02 · `pnpm test -- check-vpn.exit2` en verde: sin `--target`, sin puerto, sin valor, puerto no numérico, 0 o > 65535 y argumento desconocido imprimen un JSON con `ok: false` y `error.code: INVALID_ARGS` y salen con exit 2

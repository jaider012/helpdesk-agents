# Decisiones de la Fase 3 (frontend Angular) para revisar

Registro de las decisiones que Claude tomó por Jaider durante la Fase 3 (T-74 … T-81), que se implementa en paralelo con la Fase 2 en la rama `feat/phase-3-web`. Mismo formato que `docs/decisiones-para-revisar.md`: qué se decidió, por qué, cómo revertirlo y en qué commit está.

**Cómo revisar:** marca cada fila en la columna «Revisión» con ✅ (se queda) o ❌ (revertir, con una nota).

---

## Fase 3 · `apps/web`

| ID | Decisión | Por qué | Cómo revertir | Commit | Revisión |
| --- | --- | --- | --- | --- | --- |
| DW-01 | `apps/web` declara `engines.node` `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`; la raíz sigue en `>=22.18`. En el contenedor se instaló Node 22.23.3 con `nvm` (solo entorno, fuera del repo). | Angular CLI 22.2 (la última estable) se niega a arrancar con Node 22.22.2. Subir la raíz afectaría a la sesión de la Fase 2. | Subir `engines` de la raíz cuando se fusionen las ramas, o bajar a Angular 21 (incumple «última estable»). | `afcee26` | |
| DW-02 | `jsdom` entra como `devDependency` de `web`. | Lo añade el propio `ng new` de Angular 22 como entorno DOM de `ng test`; se trata como paquete del Angular CLI. | Quitarlo y usar `--browsers` con un navegador real (necesita otra dependencia). | `afcee26` | |
| DW-03 | Los tests de web corren con `ng test` (builder `@angular/build:unit-test`, Vitest en jsdom, compilación AOT). `run-tests.mjs` traduce `pnpm -F web test -- <patrón>` a `ng test --include <archivo>` con la semántica de filtro de Vitest (el patrón es una subcadena de la ruta). | Vitest sin el compilador de Angular solo admite JIT, y el JIT no reconoce `input()`/`output()` de señales. Con `ng test` los tests usan el mismo compilador que el build. | Pasar a Vitest directo con JIT y quitar `input()` de los componentes. | `afcee26` | |
| DW-04 | El `pnpm test` de la raíz alcanza los tests de web con un test puente (`apps/web/ng-test.bridge.test.ts`) que ejecuta `run-tests.mjs` como proceso hijo; `apps/web/vitest.config.ts` solo incluye ese archivo. | La raíz trata `apps/*` como proyectos de Vitest y no puede compilar Angular; así `pnpm test` sigue cubriendo todo el monorepo (CLAUDE.md §7) sin tocar `vitest.config.ts` de la raíz. Suma unos 7 s. | Borrar el puente y ejecutar `pnpm -F web test` como paso aparte en CI. | `afcee26` | |
| DW-05 | La caché del Angular CLI vive en `apps/web/node_modules/.cache/angular` (`cli.cache.path`). | En `.angular/cache` la caché contiene `.js` que `eslint .` de la raíz intentaría analizar, y `eslint.config.js` de la raíz no está en el alcance de esta fase. | Volver a `.angular/cache` y añadirlo a los `ignores` de ESLint. | `afcee26` | |

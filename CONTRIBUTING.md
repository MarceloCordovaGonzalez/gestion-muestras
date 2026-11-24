# Guía de contribución

## 1. Flujo de ramas (GitHub Flow)

1. Cree una incidencia (issue) con la plantilla «Requerimiento» o «Defecto».
2. Cree una rama desde `main` actualizada:
   - `feat/RF-10-filtro-comuna-mapa`
   - `fix/RN-04-empate-distancia`
   - `chore/deps-actualizacion`, `docs/adr-12`
3. Haga commits pequeños con **Conventional Commits** (validados por commitlint):

   ```
   feat(api): asignar comuna por polígono oficial en errores (RN-22)
   fix(mobile): conservar DATEVIA original al sincronizar cola (RF-08)
   feat(domain)!: cambiar contrato de geovalidar   ← «!» = cambio incompatible (mayor)
   ```

   Ámbitos: `api`, `web`, `mobile`, `domain`, `contracts`, `db`, `infra`, `ci`, `docs`, `deps`.

4. Abra un Pull Request hacia `main` con la plantilla. Requisitos para fusionar:
   - CI en verde (lint, typecheck, pruebas, CodeQL).
   - Al menos **1 aprobación** (2 si toca `packages/domain` o `db/migrations`).
   - Rama actualizada con `main`; conversaciones resueltas.
5. Se fusiona con **squash merge**; el título del PR debe ser un Conventional Commit válido.

## 2. Estándares de código

- TypeScript `strict`, sin `any`; ESLint + Prettier (se ejecutan en el pre-commit con Husky).
- Flutter: `dart format` y `flutter analyze` sin advertencias.
- Reglas de negocio en `packages/domain` como funciones puras con pruebas (cobertura ≥ 90 %).
- Cada endpoint declara su rol; cada consulta filtra por `CODEMP` del JWT (RLS como respaldo).
- Migraciones de BD solo hacia adelante, versionadas en `apps/api/prisma/migrations`.
- Sin datos personales en logs. Sin secretos en el repositorio (use Secret Manager).

## 3. Definición de terminado (DoD)

- [ ] Criterios de aceptación del RF/CU cubiertos por pruebas automatizadas.
- [ ] Contrato `packages/contracts/openapi.yaml` actualizado si cambia la API.
- [ ] Documentación (`CLAUDE.md`, ADR o runbook) actualizada si cambia una decisión.
- [ ] Desplegado y verificado en **dev**.

## 4. Versiones

Ver [`docs/releases.md`](docs/releases.md).

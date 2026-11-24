---
description: Implementa un requerimiento funcional (RF) de la Especificación Funcional v1.4
argument-hint: RF-xx [descripción breve]
---

Implemente el requerimiento **$ARGUMENTS** siguiendo este procedimiento:

1. Ubique el RF en `docs/trazabilidad.md` y en `CLAUDE.md`. Identifique los CU y RN asociados y sus
   criterios de aceptación. Si algo es ambiguo, deténgase y pregunte antes de programar.
2. Presente un plan breve (archivos a crear o modificar, pruebas, cambios de contrato) y espere
   confirmación.
3. Cree la rama `feat/<RF>-<slug>` desde `main`.
4. Implemente primero las reglas puras en `packages/domain` con pruebas que reflejen los criterios
   de aceptación (formato «Dado / cuando / entonces» en el nombre del test).
5. Integre en `apps/api` (módulo correspondiente), luego `apps/web` o `apps/mobile`.
6. Actualice `packages/contracts/openapi.yaml` si cambia la API.
7. Ejecute `pnpm lint && pnpm typecheck && pnpm test` (y `flutter test` si toca la App).
8. Proponga el mensaje de commit (Conventional Commits, citando el RF) y el texto del PR usando
   `.github/pull_request_template.md`. No haga push sin autorización.

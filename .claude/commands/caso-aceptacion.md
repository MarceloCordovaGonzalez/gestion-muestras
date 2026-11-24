---
description: Genera pruebas de aceptación a partir de un criterio de la especificación
argument-hint: CU-xx o RN-xx y el criterio en texto
---

Genere pruebas automatizadas para **$ARGUMENTS**:

1. Traduzca el criterio a formato «Dado / cuando / entonces».
2. Construya los datos de prueba en `packages/domain/test/fixtures` (o reutilice
   `escenario-30-09-2026.ts`). Use coordenadas WGS84 realistas de la Región Metropolitana.
3. Escriba la prueba en `packages/domain/test` (node:test) o en `apps/api/test` si requiere BD.
4. Ejecute las pruebas y muestre el resultado.
5. Si el criterio contradice el comportamiento actual, no cambie el código: informe la diferencia y
   el RN afectado.

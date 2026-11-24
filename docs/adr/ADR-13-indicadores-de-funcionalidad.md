# ADR-13 · Funciones pendientes de aprobación detrás de indicadores

- **Estado:** Propuesta (12/11/2026)
- **Contexto:** el cliente aprobó programar MEJ-07 (deduplicación) y dejarla activa, y programar
  MEJ-18 (retiros pendientes de entrega) desactivada en el MVP1, con decisión para el MVP2.
- **Decisión:** las funciones se integran a `main` y se controlan con indicadores resueltos en
  `packages/domain/src/feature-flags.ts` con prioridad _parámetro por empresa > variable de
  entorno > valor por defecto_. Valores por defecto: `deduplicacion = true`,
  `pendientesEntrega = false`. El indicador de MEJ-18 no es editable desde la API en el Piloto 1.
- **Consecuencias:** sin ramas de larga vida; la activación de MEJ-18 en el MVP2 es un cambio de
  configuración (más el despliegue de su interfaz), no un desarrollo nuevo. El endpoint
  `/v1/pendientes-entrega` responde 404 mientras el indicador esté apagado.

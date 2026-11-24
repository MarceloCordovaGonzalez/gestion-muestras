# ADR-12 · Monorepo pnpm con versiones independientes por componente

- **Estado:** Propuesta (12/11/2026)
- **Contexto:** el sistema tiene cuatro piezas (API, Web, App, reglas de dominio) que comparten
  contrato y reglas, pero tienen ciclos de liberación distintos (la App depende de las tiendas).
  El equipo es pequeño (Modelo 14.1).
- **Decisión:** un único repositorio con workspaces de pnpm (`apps/*`, `packages/*`), CI filtrado
  por rutas y release-please en modo manifiesto, con tags `componente-vX.Y.Z`.
- **Alternativas:** repositorios separados (más sincronización de contrato y reglas); versión única
  para todo (obliga a liberar la App ante cambios solo de la API).
- **Consecuencias:** un cambio de regla y su uso en la API se revisan en un mismo PR; cada
  componente se despliega cuando cambia. Requiere disciplina en los ámbitos de los commits
  (validados por commitlint y por el check `titulo-pr`).

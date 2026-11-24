# Runbook · Liberación a producción y marcha blanca

## Antes de aprobar el ambiente `prod`

- [ ] PR de release revisado: versión y CHANGELOG coherentes con los commits.
- [ ] QA verde: pruebas de aceptación del 30/09/2026 (15 · 6 · 5 · 1 · 40,0 % · 6,7 % · 2).
- [ ] Migraciones compatibles con la versión anterior (expandir → migrar → contraer).
- [ ] Catálogo COMUNA cargado y verificado en prod (fuente y licencia registradas).
- [ ] Indicadores: `deduplicacion = true`, `pendientesEntrega = false`.
- [ ] Ventana de despliegue fuera del horario punta (evitar 10:00–14:00).

## Durante

1. Aprobar el ambiente `prod` en GitHub Actions.
2. Observar el canario (10 %, 10 min): errores 5xx, latencia p95 ≤ 3 s, marcaciones por minuto.
3. Si hay degradación: `gcloud run services update-traffic gm-api --to-revisions <anterior>=100`.

## Marcha blanca (2 semanas, Modelo 14)

- Grupo piloto de conductores en Firebase App Distribution (`piloto-conductores`).
- Revisión diaria de marcaciones en ERROR con su distancia y precisión registrada: calibrar
  radios de centros y laboratorios (riesgo «coordenadas mal definidas»).
- Revisión diaria de retiros fuera de ruta para depurar la planificación.
- Registrar hallazgos como incidencias con la plantilla «Defecto» o «Requerimiento».

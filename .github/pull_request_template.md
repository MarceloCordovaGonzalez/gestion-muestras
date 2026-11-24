## Resumen

<!-- Qué cambia y por qué. Título del PR = Conventional Commit, p. ej. «feat(api): … (RF-10)». -->

## Trazabilidad

| Requerimientos (RF) | Casos de uso (CU) | Reglas (RN) | Incidencia |
| ------------------- | ----------------- | ----------- | ---------- |
|                     |                   |             | Cierra #   |

## Tipo de cambio

- [ ] Funcionalidad (`feat`) – sube versión menor
- [ ] Corrección (`fix`) – sube parche
- [ ] Cambio incompatible (`!` / `BREAKING CHANGE`) – sube mayor (menor en serie 0.x)
- [ ] Infraestructura, CI, documentación o mantenimiento

## Verificación

- [ ] Pruebas automatizadas que cubren los criterios de aceptación
- [ ] `pnpm lint && pnpm typecheck && pnpm test` (y `flutter test` si aplica) sin errores
- [ ] `packages/contracts/openapi.yaml` actualizado (si cambia la API)
- [ ] Migraciones solo hacia adelante (si cambia la BD)
- [ ] Sin datos personales en logs ni secretos en el código
- [ ] Autorización por rol en cada endpoint nuevo

## Evidencia

<!-- Capturas, salida de pruebas o enlace al despliegue en dev. -->

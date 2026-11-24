# Estrategia de versionamiento y liberación

## 1. Principios

- **Una sola rama de larga vida (`main`)**, siempre desplegable. Todo cambio entra por PR.
- **Versionamiento semántico (SemVer) independiente por componente**: la API, la Web, la App y el
  paquete de dominio evolucionan a ritmos distintos (la App depende de las tiendas).
- **Versiones derivadas de los commits** (Conventional Commits + release-please): nadie edita
  números de versión a mano.
- **Artefactos inmutables**: la misma imagen de la API que pasó por QA es la que llega a prod.

## 2. Componentes y tags

| Componente | Ruta              | Tag             | Artefacto                                  |
| ---------- | ----------------- | --------------- | ------------------------------------------ |
| api        | `apps/api`        | `api-vX.Y.Z`    | Imagen en Artifact Registry `gm/api:X.Y.Z` |
| web        | `apps/web`        | `web-vX.Y.Z`    | Estáticos en Cloud Storage                 |
| mobile     | `apps/mobile`     | `mobile-vX.Y.Z` | APK/AAB/IPA (`X.Y.Z+<build>`)              |
| domain     | `packages/domain` | `domain-vX.Y.Z` | Paquete interno (versión de referencia)    |

## 3. Reglas de numeración

| Commit                        | Serie 0.x (Piloto) | Serie ≥ 1.0 |
| ----------------------------- | ------------------ | ----------- |
| `fix:`                        | parche             | parche      |
| `feat:`                       | menor              | menor       |
| `feat!:` o `BREAKING CHANGE:` | menor              | **mayor**   |

- **Piloto 1 y marcha blanca:** serie `0.x`.
- **`1.0.0`:** paso a producción del MVP1 aceptado por el cliente. Se fuerza con un commit vacío
  `chore: release 1.0.0` con pie `Release-As: 1.0.0`.
- **MVP2** y **MVP3** se liberan como versiones menores (`1.1`, `1.2`, …) salvo cambios
  incompatibles de contrato, que generan `/v2` en la API y versión mayor.

## 4. Flujo de promoción

```
PR → CI (lint, tipos, pruebas, CodeQL) → squash merge a main
  └─► despliegue automático a DEV (versión main-<sha>)
  └─► release-please abre/actualiza «PR de release» por componente
         └─ al fusionarlo: tag + GitHub Release + CHANGELOG
               └─► despliegue automático a QA (misma imagen)
                     └─► aprobación manual en el ambiente «prod» (revisor designado)
                           └─► PROD: revisión nueva sin tráfico → prueba de humo →
                               canario 10 % (10 min) → 100 %
```

**App móvil:** el tag `mobile-v*` compila y publica en Firebase App Distribution para el grupo
`piloto-conductores`. La publicación en Google Play / App Store (o MDM) es manual. El servidor
controla la versión mínima aceptada (`APP_VERSION_MINIMA`) para forzar actualizaciones.

## 5. Correcciones urgentes (hotfix)

1. Si `main` puede liberarse: PR `fix:` normal → release de parche → QA → prod.
2. Si `main` contiene cambios no liberables: crear `release/api-X.Y` desde el tag vigente,
   aplicar el `fix` (cherry-pick), etiquetar `api-vX.Y.(Z+1)` y desplegar; luego llevar el fix a
   `main` por PR.

## 6. Reversión

- **API:** `gcloud run services update-traffic gm-api --to-revisions <revisión-anterior>=100`
  (inmediato). Las migraciones son solo hacia adelante y compatibles con la versión anterior
  (patrón expandir → migrar → contraer).
- **Web:** volver a ejecutar «Desplegar» con el tag anterior (`workflow_dispatch`).
- **App:** publicar una versión de parche; la anterior sigue operativa.

## 7. Indicadores de funcionalidad

Las funciones pendientes de aprobación se integran a `main` desactivadas, lo que evita ramas de
larga vida:

| Indicador           | Requerimiento  | Estado en Piloto 1 | Dónde se cambia                     |
| ------------------- | -------------- | ------------------ | ----------------------------------- |
| `deduplicacion`     | MEJ-07 / RN-07 | **Activo**         | `parametro.feature_deduplicacion`   |
| `pendientesEntrega` | MEJ-18 / RN-16 | **Desactivado**    | `FEATURE_PENDIENTES_ENTREGA` (MVP2) |

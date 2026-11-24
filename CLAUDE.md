# CLAUDE.md – Gestión de Muestras (Piloto 1 / MVP1)

Guía para Claude Code en este repositorio. Léala completa antes de modificar código.

## Contexto del producto

Sistema de gestión logística de muestras clínicas (cliente EMP1). Los conductores marcan con
geolocalización el **retiro (R)** de muestras en centros de salud y la **entrega (E)** en
laboratorios. El Administrador visualiza mapa y dashboard.

Fuentes de verdad (en el proyecto claude.ai «00-gestión de muestras»):

- Especificación Funcional – Gestión de Muestras **v1.4** (RF, RN, CU, RNF).
- Modelo de Arquitectura de Solución – Gestión de Muestras **v1.4** (componentes, ADR, API).

Siempre cite el código del requerimiento o regla (RF-xx, RN-xx, CU-xx) en commits, PR y comentarios
de código relevantes.

## Mapa del repositorio

| Ruta                 | Contenido                                                       |
| -------------------- | --------------------------------------------------------------- |
| `packages/domain`    | Reglas de negocio **puras** (sin E/S). Toda regla RN vive aquí. |
| `packages/contracts` | `openapi.yaml` (/v1). Contrato entre App, Web y API.            |
| `apps/api`           | NestJS (monolito modular), Prisma, PostgreSQL 16 + PostGIS 3.   |
| `apps/web`           | React 18 + Vite + TypeScript (perfil Administrador).            |
| `apps/mobile`        | Flutter 3 (Conductor y Administrador que marca).                |
| `db/`                | Migraciones SQL, carga de comunas y casos de prueba de QA.      |
| `infra/terraform`    | Google Cloud `southamerica-west1`, ambientes dev / qa / prod.   |
| `docs/`              | ADR, guía de releases, desarrollo local y runbooks.             |

## Comandos

```bash
pnpm install                     # dependencias (Node 22, pnpm 10)
pnpm db:up                       # PostgreSQL + PostGIS local (docker)
pnpm test:domain                 # pruebas de reglas de negocio (node:test)
pnpm --filter @gm/api dev        # API en http://localhost:8080
pnpm --filter @gm/web dev        # Web en http://localhost:5173
cd apps/mobile && flutter pub get && flutter test
pnpm lint && pnpm typecheck && pnpm test   # antes de abrir un PR
```

## Reglas de negocio críticas (no romper)

- **RN-03/RN-04:** buscar SIEMPRE en centros y laboratorios; con varios candidatos (de una o ambas
  listas) se elige el **punto más cercano**. HAL-14: si no hay centro, se continúa con laboratorios.
- **RN-05:** centro → `R`, laboratorio → `E`, sin punto → `TIPVIA = null` y `ESTVIA = ERROR`.
- **RN-22:** toda marcación tiene `COMUNA`. En error, la comuna sale del polígono oficial que
  contiene el punto (PostGIS `ST_Contains`); respaldo: comuna más cercana. Nunca vacía.
- **RN-21:** retiro CORRECTO sin ruta ACTIVA y vigente para ese centro y día de la semana →
  `FUERARUTA = 'S'`. Nunca se rechaza. Entregas y errores → `'N'`.
- **RN-07 (MEJ-07, ACTIVA):** duplicado = mismo conductor, mismo punto, dentro de 10 min. La
  segunda solo se registra si el conductor confirma (`confirmarDuplicado: true`).
- **RN-16 (MEJ-18, DESACTIVADA en MVP1):** retiros pendientes de entrega. Código presente detrás
  del flag `pendientesEntrega`; por confirmar para MVP2. No activar sin aprobación del cliente.
- **RN-08 a RN-13:** KPI del dashboard. Si planificados = 0 → porcentajes «—» (`null`).
- **RF-09:** la precisión GPS solo se **registra** en MVP1; su validación es MVP3.
- **RF-16:** el importador procesa CENTRO, LABORATORIO, CONDUCTOR, RUTA CONDUCTOR. La hoja VIAJE
  se **ignora** en producción (solo casos de prueba en QA).
- **RN-06/RNF-10:** horas en UTC (`timestamptz`); presentación y «fecha del día» en
  `America/Santiago`.
- **RN-20:** `CODEMP` sale del JWT, nunca se fija en el código.

## Convenciones

- TypeScript `strict`, sin `any`. Funciones de dominio puras y con pruebas (cobertura ≥ 90 %, RNF-11).
- Nombres de columnas iguales a la planilla del cliente (CODCEN, TIPVIA, ESTVIA…) en BD y DTO.
- Idioma: dominio y mensajes al usuario en español; identificadores técnicos en español sin tildes.
- Commits: Conventional Commits con ámbito (`feat(api): …`). Ver `CONTRIBUTING.md`.
- Ramas: `feat/RF-xx-descripcion`, `fix/…`, `chore/…`. Nunca commit directo a `main`.
- Autorización por rol en **cada** endpoint (`@Roles('ADMINISTRADOR')`), no solo en la interfaz.
- No registrar datos personales (RUT, celular, coordenadas) en logs (RNF-05, Ley 21.719).

## Qué NO hacer

- No modificar marcaciones existentes: las correcciones son ajustes auditados (CU-10, MVP2).
- No agregar perfiles distintos de CONDUCTOR y ADMINISTRADOR (cu v1.1).
- No introducir geocodificación externa para la comuna (ADR-09).
- No versionar secretos, planillas reales del cliente ni cartografía descargada.

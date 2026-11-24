# Gestión de Muestras – Piloto 1 (MVP1)

Sistema de gestión logística y transporte de muestras de laboratorios clínicos: retiro en centros
de salud y entrega en laboratorios, validados por geolocalización de los conductores.

> Cliente: Servicio de traslado de muestras clínicas (EMP1) · Elaborado por: Tech Analytic Solutions
> Base: Especificación Funcional v1.4 y Modelo de Arquitectura v1.4 (10/11/2026).

## Alcance del Piloto 1

| Componente             | Incluye                                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App móvil (Flutter)    | CU-01 OTP y enrolamiento · CU-02 marcación con confirmación (comuna y estado) · historial del día · cola sin conexión (RF-08) · registro de precisión GPS (RF-09 solo registro)                                            |
| API (NestJS + PostGIS) | Geovalidación en ambas listas con punto más cercano (RN-03 a RN-05) · comuna por límites oficiales (RN-22) · fuera de ruta (RN-21) · idempotencia por IDVIA · deduplicación (RN-07, activa) · retiros planificados (RN-08) |
| Web (React)            | CU-03 mapa · CU-04 dashboard (7 cuadros) · CU-05 importación sin hoja VIAJE · avisos de fuera de ruta                                                                                                                      |
| Desactivado            | RN-16 / MEJ-18 retiros pendientes de entrega (flag `pendientesEntrega`, por confirmar MVP2)                                                                                                                                |

## Arquitectura

```
App Flutter ──┐                       ┌── Cloud SQL PostgreSQL 16 + PostGIS
              ├── HTTPS/JWT ── API NestJS (Cloud Run) ──┤
Web React ────┘                       └── Cloud Storage (planillas, exportaciones)
Identity Platform (OTP SMS / MFA) · Cloud Scheduler + Jobs (planificación diaria 00:05)
```

Detalle de decisiones en [`docs/adr`](docs/adr/README.md).

## Inicio rápido

Requisitos: Node 22, pnpm 10, Docker, Flutter 3.24+ (para la App).

```bash
pnpm install
cp .env.example apps/api/.env
pnpm db:up
pnpm --filter @gm/api prisma:migrate
pnpm --filter @gm/api dev
pnpm --filter @gm/web dev
```

Más detalle en [`docs/desarrollo-local.md`](docs/desarrollo-local.md).

## Flujo de trabajo y versiones

- GitHub Flow sobre `main` protegida, PR con revisión obligatoria y checks en verde.
- Conventional Commits → release-please genera versiones SemVer **por componente**
  (`api-v0.1.0`, `web-v0.1.0`, `mobile-v0.1.0`, `domain-v0.1.0`) y su CHANGELOG.
- Promoción: `main` → **dev** (automático) · release → **qa** · aprobación manual → **prod**.

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md) y [`docs/releases.md`](docs/releases.md).

## Trabajo con Claude Code

El archivo [`CLAUDE.md`](CLAUDE.md) contiene el contexto de dominio y las reglas. Comandos del
proyecto en `.claude/commands`: `/implementar-rf`, `/revisar-pr`, `/preparar-release`,
`/caso-aceptacion`. Subagentes en `.claude/agents`: `revisor-geovalidacion`, `qa-aceptacion`.

## Licencia

Software propietario de uso exclusivo del cliente y Tech Analytic Solutions. Todos los derechos
reservados.

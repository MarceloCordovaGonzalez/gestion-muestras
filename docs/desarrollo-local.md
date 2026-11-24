# Desarrollo local

## Requisitos

Node 22 · pnpm 10 · Docker · Flutter 3.24+ · GDAL (`ogr2ogr`) para cargar comunas · Terraform 1.6+.

## Pasos

```bash
pnpm install
cp .env.example apps/api/.env
pnpm db:up                                   # PostGIS en localhost:5432
pnpm --filter @gm/domain build               # la API consume el paquete compilado
pnpm --filter @gm/api prisma:generate
pnpm --filter @gm/api prisma:migrate         # aplica prisma/migrations
DATABASE_URL=postgresql://gm:gm_local_only@localhost:5432/gestion_muestras \
  ./db/comunas/cargar-comunas.sh ~/Descargas/comunas.shp
pnpm --filter @gm/api dev                    # http://localhost:8080/v1/docs (Swagger)
pnpm --filter @gm/web dev                    # http://localhost:5173
```

> **Seguridad por fila:** la API debe conectarse con un usuario que **no** sea dueño de las
> tablas (los dueños omiten RLS). En local se puede usar el mismo usuario; en dev/qa/prod la
> cuenta de servicio IAM de Cloud SQL solo tiene privilegios DML.

## Tokens de prueba (solo con `AUTH_DEV_BYPASS=true`, nunca en producción)

Formato: `dev:<PERFIL>:<CODEMP>:<rutcon>:<iddis>:<telefono>`

```bash
# Administrador web
curl -H "Authorization: Bearer dev:ADMINISTRADOR:EMP1" localhost:8080/v1/dashboard/detalle?fecha=2026-09-30

# Enrolar un conductor (primer ingreso tras OTP)
curl -X POST -H "Authorization: Bearer dev:CONDUCTOR:EMP1::::+56912345678" \
     -H 'content-type: application/json' -d '{"idinst":"emulador-1"}' localhost:8080/v1/auth/dispositivos

# Marcar (use el rutcon e iddis devueltos por el enrolamiento)
curl -X POST -H "Authorization: Bearer dev:CONDUCTOR:EMP1:12345678:<iddis>" -H 'content-type: application/json' \
     -d '{"idvia":"6f1c2e0a-8d0b-4c1e-9a1e-2f3b4c5d6e7f","datevia":"2026-09-30T12:02:25-03:00","lat":-33.57691,"lon":-70.64935,"precision":8,"origen":"EN_LINEA"}' \
     localhost:8080/v1/marcaciones
```

## Pruebas

```bash
pnpm test:domain                              # reglas de negocio (59 casos, escenario 30/09/2026)
pnpm --filter @gm/domain test:coverage        # cobertura ≥ 90 % (RNF-11)
pnpm --filter @gm/api test
pnpm --filter @gm/web test
cd apps/mobile && flutter test
```

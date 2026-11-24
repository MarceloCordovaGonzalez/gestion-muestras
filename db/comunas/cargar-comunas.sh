#!/usr/bin/env bash
# Carga el catálogo COMUNA con los límites comunales oficiales (RN-22, ADR-09).
#
# Fuente sugerida: División Político-Administrativa (DPA) publicada por el Estado de Chile
# (IDE Chile / BCN / INE). ANTES de cargar, verifique la fuente y su licencia de uso
# (Modelo de Arquitectura 8.3). El archivo descargado NO se versiona en el repositorio.
#
# Uso:
#   DATABASE_URL=postgresql://... ./db/comunas/cargar-comunas.sh ruta/comunas.shp|.geojson
#
# Requisitos: GDAL (ogr2ogr) y psql. Atributos esperados en la fuente (ajuste el mapeo si cambia):
#   CUT_COM (código), COMUNA (nombre), REGION, PROVINCIA.
set -euo pipefail

FUENTE="${1:?Indique el archivo de límites comunales (.shp o .geojson)}"
: "${DATABASE_URL:?Defina DATABASE_URL}"

echo "» Cargando ${FUENTE} en la tabla temporal comuna_carga…"
ogr2ogr -f PostgreSQL "PG:${DATABASE_URL}" "${FUENTE}" \
  -nln comuna_carga -overwrite -nlt PROMOTE_TO_MULTI -t_srs EPSG:4326 -lco GEOMETRY_NAME=geom

echo "» Normalizando y copiando al catálogo COMUNA (regiones atendidas)…"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO comuna (codcom, nomcom, region, provincia, geom)
SELECT lpad(cut_com::text, 5, '0'),
       upper(translate(comuna, 'áéíóúÁÉÍÓÚüÜ', 'aeiouAEIOUuU')),
       region, provincia, ST_Multi(ST_MakeValid(geom))
FROM comuna_carga
-- Regiones atendidas (Especificación 2.1). Ajuste los nombres según la fuente utilizada.
WHERE region ILIKE ANY (ARRAY['%Metropolitana%', '%Valpara%so%', '%Higgins%'])
ON CONFLICT (codcom) DO UPDATE
  SET nomcom = EXCLUDED.nomcom, region = EXCLUDED.region,
      provincia = EXCLUDED.provincia, geom = EXCLUDED.geom;
DROP TABLE comuna_carga;
COMMIT;
SELECT region, count(*) FROM comuna GROUP BY region ORDER BY region;
SQL
echo "✔ Catálogo de comunas cargado."

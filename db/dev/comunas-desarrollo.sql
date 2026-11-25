-- =============================================================================
-- COMUNAS SINTÉTICAS · SOLO PARA DESARROLLO LOCAL Y CI
--
-- Rectángulos APROXIMADOS que cubren los puntos del escenario de demostración del 30/09/2026.
-- NO representan los límites oficiales y NO deben cargarse en QA ni en producción: allí se usa
-- la cartografía oficial con db/comunas/cargar-comunas.sh (RN-22, ADR-09).
-- Los códigos corresponden a la codificación territorial; la geometría es ficticia.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM comuna WHERE region NOT LIKE '%(sintética)%') THEN
    RAISE EXCEPTION 'comunas-desarrollo.sql: la base ya contiene comunas oficiales; no se cargan comunas sintéticas.';
  END IF;
END $$;

INSERT INTO comuna (codcom, nomcom, region, provincia, geom)
SELECT c.codcom, c.nomcom, 'Metropolitana (sintética)', c.provincia,
       ST_Multi(ST_MakeEnvelope(c.lon_min, c.lat_min, c.lon_max, c.lat_max, 4326))
FROM (VALUES
  --  codcom   nomcom          provincia    lon_min  lat_min  lon_max  lat_max
  ('13101', 'SANTIAGO',     'Santiago',  -70.690, -33.470, -70.630, -33.420),
  ('13131', 'SAN RAMON',    'Santiago',  -70.655, -33.560, -70.635, -33.525),
  ('13111', 'LA GRANJA',    'Santiago',  -70.635, -33.560, -70.590, -33.525),
  ('13110', 'LA FLORIDA',   'Santiago',  -70.590, -33.560, -70.540, -33.500),
  ('13112', 'LA PINTANA',   'Santiago',  -70.680, -33.650, -70.600, -33.560),
  ('13201', 'PUENTE ALTO',  'Cordillera', -70.600, -33.650, -70.540, -33.560),
  ('13601', 'TALAGANTE',    'Talagante', -71.050, -33.720, -70.850, -33.550)
) AS c(codcom, nomcom, provincia, lon_min, lat_min, lon_max, lat_max)
ON CONFLICT (codcom) DO NOTHING;

SELECT codcom, nomcom, region FROM comuna ORDER BY nomcom;

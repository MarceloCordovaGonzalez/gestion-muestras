-- =============================================================================
-- Gestión de Muestras · Migración inicial (Piloto 1 / MVP1)
-- Modelo de Arquitectura v1.4, sección 8.1. Nombres de columnas según la planilla del cliente.
-- Fechas en UTC (timestamptz); fecha local America/Santiago como columna generada (RNF-10).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Catálogo de comunas con límites oficiales (RN-22, ADR-09)
-- -----------------------------------------------------------------------------
CREATE TABLE comuna (
  codcom     varchar(10)  PRIMARY KEY,           -- código territorial
  nomcom     varchar(60)  NOT NULL UNIQUE,       -- nombre normalizado en MAYÚSCULAS
  region     varchar(60)  NOT NULL,
  provincia  varchar(60),
  geom       geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX comuna_geom_gix ON comuna USING gist (geom);

-- -----------------------------------------------------------------------------
-- Datos maestros (claves naturales compuestas, como en la planilla)
-- -----------------------------------------------------------------------------
CREATE TABLE laboratorio (
  codemp   varchar(10)  NOT NULL,
  codlab   integer      NOT NULL,
  comlab   varchar(60)  NOT NULL REFERENCES comuna (nomcom),
  deslab   varchar(120) NOT NULL,
  alilab   varchar(40)  NOT NULL,
  dirlab   varchar(150),
  latlab   numeric(9,6) NOT NULL CHECK (latlab BETWEEN -56 AND -17.5),
  lonlab   numeric(9,6) NOT NULL CHECK (lonlab BETWEEN -76 AND -66),
  radlab   integer      CHECK (radlab BETWEEN 10 AND 1000),
  estlab   varchar(10)  NOT NULL DEFAULT 'ACTIVO' CHECK (estlab IN ('ACTIVO','INACTIVO')),
  geo      geography(Point, 4326)
           GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lonlab::float8, latlab::float8), 4326)::geography) STORED,
  usrcre   varchar(120) NOT NULL DEFAULT 'sistema',
  datecre  timestamptz  NOT NULL DEFAULT now(),
  usract   varchar(120),
  dateact  timestamptz,
  PRIMARY KEY (codemp, codlab)
);
CREATE INDEX laboratorio_geo_gix ON laboratorio USING gist (geo);

CREATE TABLE centro (
  codemp   varchar(10)  NOT NULL,
  codcen   integer      NOT NULL,
  comcen   varchar(60)  NOT NULL REFERENCES comuna (nomcom),
  descen   varchar(120) NOT NULL,
  alicen   varchar(40)  NOT NULL,
  dircen   varchar(150),
  latcen   numeric(9,6) NOT NULL CHECK (latcen BETWEEN -56 AND -17.5),
  loncen   numeric(9,6) NOT NULL CHECK (loncen BETWEEN -76 AND -66),
  radcen   integer      CHECK (radcen BETWEEN 10 AND 1000),
  lun      char(1)      NOT NULL CHECK (lun IN ('S','N')),
  mar      char(1)      NOT NULL CHECK (mar IN ('S','N')),
  mie      char(1)      NOT NULL CHECK (mie IN ('S','N')),
  jue      char(1)      NOT NULL CHECK (jue IN ('S','N')),
  vie      char(1)      NOT NULL CHECK (vie IN ('S','N')),
  sab      char(1)      NOT NULL CHECK (sab IN ('S','N')),
  dom      char(1)      NOT NULL CHECK (dom IN ('S','N')),
  codlab   integer      NOT NULL,
  estcen   varchar(10)  NOT NULL DEFAULT 'ACTIVO' CHECK (estcen IN ('ACTIVO','INACTIVO')),
  geo      geography(Point, 4326)
           GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(loncen::float8, latcen::float8), 4326)::geography) STORED,
  usrcre   varchar(120) NOT NULL DEFAULT 'sistema',
  datecre  timestamptz  NOT NULL DEFAULT now(),
  usract   varchar(120),
  dateact  timestamptz,
  PRIMARY KEY (codemp, codcen),
  FOREIGN KEY (codemp, codlab) REFERENCES laboratorio (codemp, codlab)
);
CREATE INDEX centro_geo_gix ON centro USING gist (geo);

CREATE TABLE usuario (
  idusr    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  codemp   varchar(10)  NOT NULL,
  uid_idp  varchar(128) UNIQUE,                  -- uid de Identity Platform
  correo   varchar(120) UNIQUE,
  nombre   varchar(120) NOT NULL,
  perfil   varchar(15)  NOT NULL CHECK (perfil IN ('CONDUCTOR','ADMINISTRADOR')),  -- cu v1.1
  estado   varchar(10)  NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
  mfa      boolean      NOT NULL DEFAULT false,
  datecre  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE conductor (
  codemp     varchar(10)  NOT NULL,
  rutcon     integer      NOT NULL CHECK (rutcon > 0),
  dvecon     char(1)      NOT NULL,
  nomcon     varchar(60)  NOT NULL,
  priapecon  varchar(60)  NOT NULL,
  segapecon  varchar(60),
  alicon     varchar(40),
  celcon     varchar(15)  NOT NULL CHECK (celcon ~ '^\+569[0-9]{8}$'),   -- RN-01 (E.164)
  emailcon   varchar(120),
  estcon     varchar(10)  NOT NULL DEFAULT 'ACTIVO' CHECK (estcon IN ('ACTIVO','INACTIVO')),
  idusr      uuid REFERENCES usuario (idusr),   -- Administrador que marca (RN-23)
  usrcre     varchar(120) NOT NULL DEFAULT 'sistema',
  datecre    timestamptz  NOT NULL DEFAULT now(),
  usract     varchar(120),
  dateact    timestamptz,
  PRIMARY KEY (codemp, rutcon),
  UNIQUE (codemp, celcon)
);

CREATE TABLE dispositivo (
  iddis     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  codemp    varchar(10)  NOT NULL,
  rutcon    integer      NOT NULL,
  idinst    varchar(128) NOT NULL,              -- identificador de instalación de la App
  modelo    varchar(80),
  so        varchar(40),
  estado    varchar(10)  NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','REVOCADO')),
  fecenr    timestamptz  NOT NULL DEFAULT now(),
  ultuso    timestamptz,
  FOREIGN KEY (codemp, rutcon) REFERENCES conductor (codemp, rutcon)
);
-- Política del Piloto: un dispositivo ACTIVO por conductor (decisión pendiente N° 9: reemplazo).
CREATE UNIQUE INDEX dispositivo_activo_uq ON dispositivo (codemp, rutcon) WHERE estado = 'ACTIVO';

CREATE TABLE ruta_conductor (
  idrut    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  codemp   varchar(10)  NOT NULL,
  rutcon   integer      NOT NULL,
  codcen   integer      NOT NULL,
  horrut   time         NOT NULL,
  diasem   smallint     CHECK (diasem BETWEEN 1 AND 7),   -- MVP2 (RF-29)
  tolmin   smallint,
  vigdes   date,
  vighas   date,
  estrut   varchar(10)  NOT NULL DEFAULT 'ACTIVO' CHECK (estrut IN ('ACTIVO','INACTIVO')),
  usrcre   varchar(120) NOT NULL DEFAULT 'sistema',
  datecre  timestamptz  NOT NULL DEFAULT now(),
  usract   varchar(120),
  dateact  timestamptz,
  FOREIGN KEY (codemp, rutcon) REFERENCES conductor (codemp, rutcon),
  FOREIGN KEY (codemp, codcen) REFERENCES centro (codemp, codcen),
  UNIQUE NULLS NOT DISTINCT (codemp, rutcon, codcen, horrut, diasem),
  CHECK (vighas IS NULL OR vigdes IS NULL OR vighas >= vigdes)
);
CREATE INDEX ruta_conductor_busq_ix ON ruta_conductor (codemp, rutcon, codcen) WHERE estrut = 'ACTIVO';

-- -----------------------------------------------------------------------------
-- Transaccional
-- -----------------------------------------------------------------------------
CREATE TABLE retiro_planificado (
  idpla    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  codemp   varchar(10)  NOT NULL,
  fecpla   date         NOT NULL,
  idrut    uuid         NOT NULL REFERENCES ruta_conductor (idrut),
  rutcon   integer      NOT NULL,
  codcen   integer      NOT NULL,
  horpla   time         NOT NULL,
  estcum   varchar(12)  NOT NULL DEFAULT 'PENDIENTE'
           CHECK (estcum IN ('PENDIENTE','A_TIEMPO','CON_ATRASO','AUSENTE','JUSTIFICADO')),
  idvia    uuid,
  mindesv  integer,
  justificacion text,
  UNIQUE (codemp, fecpla, idrut)
);
CREATE INDEX retiro_planificado_fecha_ix ON retiro_planificado (codemp, fecpla);

CREATE TABLE viaje (
  idvia      uuid         PRIMARY KEY,           -- generado en el dispositivo (idempotencia)
  codemp     varchar(10)  NOT NULL,
  datevia    timestamptz  NOT NULL,              -- hora del dispositivo (RN-06)
  datesrv    timestamptz  NOT NULL DEFAULT now(),-- hora de recepción
  fecvia     date GENERATED ALWAYS AS ((datevia AT TIME ZONE 'America/Santiago')::date) STORED,
  rutcon     integer      NOT NULL,
  celcon     varchar(15)  NOT NULL,
  tipvia     char(1)      CHECK (tipvia IN ('R','E')),
  comuna     varchar(60)  NOT NULL,              -- RN-22: nunca nula
  codcen     integer,
  codlab     integer,
  latvia     numeric(9,6) NOT NULL,
  lonvia     numeric(9,6) NOT NULL,
  geo        geography(Point, 4326)
             GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lonvia::float8, latvia::float8), 4326)::geography) STORED,
  estvia     varchar(10)  NOT NULL CHECK (estvia IN ('CORRECTO','ERROR')),
  fueraruta  char(1)      NOT NULL DEFAULT 'N' CHECK (fueraruta IN ('S','N')),
  precision  integer      NOT NULL CHECK (precision >= 0),     -- RF-09: solo registro en MVP1
  distancia  integer,
  moterr     varchar(30)  CHECK (moterr IN ('FUERA_DE_GEOCERCA','DUPLICADO','BAJA_PRECISION','UBICACION_SIMULADA')),
  idpla      uuid REFERENCES retiro_planificado (idpla),
  iddis      uuid         NOT NULL REFERENCES dispositivo (iddis),
  origen     varchar(25)  NOT NULL CHECK (origen IN ('EN_LINEA','SIN_CONEXION','AJUSTE_ADMINISTRADOR')),
  duplicado_confirmado boolean NOT NULL DEFAULT false,         -- RN-07 confirmado por el conductor
  revisar_desfase      boolean NOT NULL DEFAULT false,         -- RN-06 desfase > 10 min no explicado
  app_version varchar(20),
  FOREIGN KEY (codemp, rutcon) REFERENCES conductor (codemp, rutcon),
  FOREIGN KEY (codemp, codcen) REFERENCES centro (codemp, codcen),
  FOREIGN KEY (codemp, codlab) REFERENCES laboratorio (codemp, codlab),
  CHECK ((tipvia = 'R' AND codcen IS NOT NULL AND codlab IS NULL)
      OR (tipvia = 'E' AND codlab IS NOT NULL AND codcen IS NULL)
      OR (tipvia IS NULL AND estvia = 'ERROR' AND codcen IS NULL AND codlab IS NULL)),
  CHECK (fueraruta = 'N' OR (tipvia = 'R' AND estvia = 'CORRECTO'))  -- RN-21
);
CREATE INDEX viaje_fecha_comuna_ix ON viaje (codemp, fecvia, comuna);
CREATE INDEX viaje_kpi_ix          ON viaje (codemp, fecvia, tipvia, estvia);
CREATE INDEX viaje_conductor_ix    ON viaje (codemp, rutcon, fecvia, tipvia);   -- RN-07 y RN-16
CREATE INDEX viaje_geo_gix         ON viaje USING gist (geo);

ALTER TABLE retiro_planificado
  ADD CONSTRAINT retiro_planificado_viaje_fk FOREIGN KEY (idvia) REFERENCES viaje (idvia);

CREATE TABLE aviso (
  idavi     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  codemp    varchar(10)  NOT NULL,
  fecavi    date         NOT NULL,
  tipo      varchar(40)  NOT NULL CHECK (tipo IN ('RETIRO_FUERA_DE_RUTA','MARCACION_SOSPECHOSA','ENTREGA_LAB_DISTINTO','PENDIENTE_ENTREGA')),
  idvia     uuid REFERENCES viaje (idvia),
  rutcon    integer,
  detalle   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  leido     boolean      NOT NULL DEFAULT false,
  datecre   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX aviso_fecha_ix ON aviso (codemp, fecavi, leido);

CREATE TABLE kpi_diario (
  codemp    varchar(10)  NOT NULL,
  fecha     date         NOT NULL,
  detalle   jsonb        NOT NULL,
  datecre   timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (codemp, fecha)
);

-- -----------------------------------------------------------------------------
-- Configuración, calendario y auditoría
-- -----------------------------------------------------------------------------
CREATE TABLE parametro (
  codemp                  varchar(10) PRIMARY KEY,
  tolerancia_min          smallint NOT NULL DEFAULT 15,
  umbral_ausencia_min     smallint NOT NULL DEFAULT 120,
  precision_max_m         smallint NOT NULL DEFAULT 50,     -- MVP3
  radio_defecto_m         smallint NOT NULL DEFAULT 100,
  ventana_dedup_min       smallint NOT NULL DEFAULT 10,
  plazo_pendiente_horas   smallint NOT NULL DEFAULT 3,
  feature_deduplicacion   boolean,                          -- NULL = valor por defecto (activo)
  feature_pendientes_entrega boolean,                       -- NULL = valor por defecto (inactivo)
  canales_alerta          jsonb NOT NULL DEFAULT '["WEB"]'::jsonb,
  dateact                 timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feriado (
  codemp       varchar(10) NOT NULL,
  fecha        date        NOT NULL,
  descripcion  varchar(120) NOT NULL,
  PRIMARY KEY (codemp, fecha)
);

CREATE TABLE importacion (
  idimp      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codemp     varchar(10) NOT NULL,
  archivo    varchar(255) NOT NULL,
  ruta_gcs   varchar(500),
  estado     varchar(15) NOT NULL CHECK (estado IN ('VALIDADA','CON_ERRORES','APLICADA','DESCARTADA')),
  resumen    jsonb       NOT NULL,
  usrcre     varchar(120) NOT NULL,
  datecre    timestamptz NOT NULL DEFAULT now(),
  dateapl    timestamptz
);

CREATE TABLE auditoria (
  idaud      bigserial   PRIMARY KEY,
  codemp     varchar(10) NOT NULL,
  usuario    varchar(120) NOT NULL,
  accion     varchar(60) NOT NULL,
  entidad    varchar(60) NOT NULL,
  clave      varchar(120),
  valor_ant  jsonb,
  valor_nue  jsonb,
  ip         inet,
  fecha      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_fecha_ix ON auditoria (codemp, fecha DESC);

-- -----------------------------------------------------------------------------
-- Seguridad por fila por empresa (Modelo de Arquitectura 8.1). La API fija
-- `SET LOCAL app.codemp = '<CODEMP del JWT>'` al inicio de cada transacción.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['laboratorio','centro','usuario','conductor','dispositivo','ruta_conductor',
                           'retiro_planificado','viaje','aviso','kpi_diario','parametro','feriado',
                           'importacion','auditoria']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (codemp = current_setting(''app.codemp'', true)) '
      'WITH CHECK (codemp = current_setting(''app.codemp'', true))', t || '_por_empresa', t);
  END LOOP;
END $$;

-- Empresa inicial (RN-20)
INSERT INTO parametro (codemp) VALUES ('EMP1');

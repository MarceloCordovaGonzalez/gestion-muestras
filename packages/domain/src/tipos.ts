/**
 * Tipos del dominio. Los nombres de campos conservan la nomenclatura de la planilla
 * MODELO_DATOS_MUESTRAS_2 (Especificación Funcional v1.4, sección 9).
 */

export type TipoViaje = 'R' | 'E';
export type EstadoViaje = 'CORRECTO' | 'ERROR';
export type IndicadorSN = 'S' | 'N';
export type EstadoRegistro = 'ACTIVO' | 'INACTIVO';
export type OrigenViaje = 'EN_LINEA' | 'SIN_CONEXION' | 'AJUSTE_ADMINISTRADOR';

/** MOTERR. BAJA_PRECISION y UBICACION_SIMULADA se usan desde el MVP3 (RF-09). */
export type MotivoError =
  'FUERA_DE_GEOCERCA' | 'DUPLICADO' | 'BAJA_PRECISION' | 'UBICACION_SIMULADA';

export interface Coordenada {
  lat: number;
  lon: number;
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Días S/N de operación de un centro (columnas LUN … DOM). */
export type DiasOperacion = Record<DiaSemana, IndicadorSN>;

export interface Centro extends Coordenada {
  codcen: number;
  comcen: string;
  alicen: string;
  radcen: number | null;
  codlab: number;
  dias: DiasOperacion;
  estcen: EstadoRegistro;
}

export interface Laboratorio extends Coordenada {
  codlab: number;
  comlab: string;
  alilab: string;
  radlab: number | null;
  estlab: EstadoRegistro;
}

export interface RutaConductor {
  idrut: string;
  rutcon: number;
  codcen: number;
  /** Hora planificada HH:MM:SS (hora local America/Santiago). */
  horrut: string;
  /** MVP2: día de la semana al que aplica el horario. null = todos los días con «S». */
  diasem: DiaSemana | null;
  /** Vigencia opcional (YYYY-MM-DD, inclusiva). */
  vigdes: string | null;
  vighas: string | null;
  estrut: EstadoRegistro;
}

/** Registro de la lista Viaje (subconjunto usado por las reglas). */
export interface Viaje {
  idvia: string;
  rutcon: number;
  /** Fecha y hora de la marcación (ISO 8601 con zona). */
  datevia: string;
  tipvia: TipoViaje | null;
  estvia: EstadoViaje;
  codcen: number | null;
  codlab: number | null;
  comuna: string;
  fueraruta: IndicadorSN;
}

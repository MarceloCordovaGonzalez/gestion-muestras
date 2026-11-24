/**
 * Escenario de aceptación del miércoles 30/09/2026.
 *
 * Reproduce los casos descritos en la Especificación Funcional v1.4 (secciones 6.2 a 6.4) con
 * coordenadas sintéticas: los valores esperados del dashboard son 15 planificados, 6 retiros,
 * 5 entregas, 1 error, 40,0 %, 6,7 %, 2 fuera de ruta y 1 pendiente de entrega.
 *
 * Cuando el cliente autorice su uso, la hoja VIAJE real de MODELO_DATOS_MUESTRAS_2 se carga en QA
 * (db/seeds/qa) y reemplaza estas coordenadas sintéticas (reparo del cliente al RF-16).
 */
import type { Centro, DiasOperacion, Laboratorio, RutaConductor } from '../../src/tipos.ts';

export const FECHA = '2026-09-30'; // miércoles; Chile en horario de verano (UTC−03:00)

const MIE_SI: DiasOperacion = { 1: 'S', 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'N', 7: 'N' };
const MIE_NO: DiasOperacion = { 1: 'S', 2: 'S', 3: 'N', 4: 'S', 5: 'S', 6: 'N', 7: 'N' };

/** 92 m hacia el norte expresados en grados de latitud. */
const DEG_92M = 92 / 111_195;

const centro = (
  codcen: number,
  alicen: string,
  comcen: string,
  lat: number,
  lon: number,
  codlab = 16,
  dias: DiasOperacion = MIE_SI,
): Centro => ({ codcen, alicen, comcen, lat, lon, radcen: 100, codlab, dias, estcen: 'ACTIVO' });

export const CENTROS: Centro[] = [
  centro(1, 'CM Mariano Latorre', 'LA PINTANA', -33.59, -70.635),
  centro(2, 'CESFAM Pintana Sur', 'LA PINTANA', -33.595, -70.625),
  centro(3, 'CESFAM La Granja', 'LA GRANJA', -33.54, -70.625),
  centro(4, 'CM La Granja Oriente', 'LA GRANJA', -33.545, -70.62),
  centro(5, 'CM Santo Tomás', 'LA PINTANA', -33.57691, -70.64935),
  centro(6, 'CESFAM San Ramón', 'SAN RAMON', -33.535, -70.645),
  centro(7, 'CM Puente Alto Centro', 'PUENTE ALTO', -33.6, -70.58, 17),
  centro(8, 'CESFAM Bajos de Mena', 'PUENTE ALTO', -33.62, -70.59, 17),
  centro(9, 'CM El Castillo', 'LA PINTANA', -33.605, -70.64),
  centro(10, 'CM El Roble', 'LA PINTANA', -33.58, -70.63),
  centro(11, 'CESFAM Santiago de Nueva Extremadura', 'LA PINTANA', -33.61, -70.62),
  centro(12, 'CM Juan Pablo II', 'LA PINTANA', -33.6, -70.61),
  centro(13, 'CESFAM El Roble Norte', 'LA GRANJA', -33.55, -70.6),
  centro(14, 'CM Laurita Vicuña', 'PUENTE ALTO', -33.59, -70.57, 17),
  centro(15, 'CM Infantil El Roble', 'LA PINTANA', -33.58 + DEG_92M, -70.63),
  centro(20, 'CM Sin Retiro Miércoles', 'LA PINTANA', -33.63, -70.66, 16, MIE_NO),
  { ...centro(21, 'CM Inactivo', 'LA PINTANA', -33.64, -70.67), estcen: 'INACTIVO' },
];

export const LABORATORIOS: Laboratorio[] = [
  {
    codlab: 16,
    alilab: 'Lab. Central Sur',
    comlab: 'LA PINTANA',
    lat: -33.565,
    lon: -70.613,
    radlab: 100,
    estlab: 'ACTIVO',
  },
  {
    codlab: 17,
    alilab: 'Lab. Cordillera',
    comlab: 'PUENTE ALTO',
    lat: -33.61,
    lon: -70.575,
    radlab: 100,
    estlab: 'ACTIVO',
  },
];

export const C1 = 1;
export const C2 = 2;
export const C9867923 = 9_867_923;
export const C10362399 = 10_362_399;
export const C9989123 = 9_989_123;

let n = 0;
const ruta = (
  rutcon: number,
  codcen: number,
  horrut: string,
  estrut: 'ACTIVO' | 'INACTIVO' = 'ACTIVO',
): RutaConductor => ({
  idrut: `rut-${++n}`,
  rutcon,
  codcen,
  horrut,
  diasem: null,
  vigdes: null,
  vighas: null,
  estrut,
});

export const RUTAS: RutaConductor[] = [
  ruta(C1, 1, '11:00:00'),
  ruta(C2, 2, '11:00:00'),
  ruta(C9867923, 5, '11:00:00'),
  ruta(C10362399, 10, '12:00:00'),
  ruta(C9989123, 4, '11:00:00'),
  // Diez rutas de otros conductores que el 30/09 quedan sin retiro (ausentes en MVP2).
  ruta(100, 6, '09:00:00'),
  ruta(101, 8, '09:30:00'),
  ruta(102, 9, '10:00:00'),
  ruta(103, 11, '10:30:00'),
  ruta(104, 12, '11:30:00'),
  ruta(105, 13, '12:30:00'),
  ruta(106, 14, '13:00:00'),
  ruta(107, 15, '13:30:00'),
  ruta(108, 6, '15:00:00'),
  ruta(109, 8, '16:00:00'),
  // No cuentan como planificados el miércoles:
  ruta(110, 20, '10:00:00'), // centro con «N» el miércoles
  ruta(111, 9, '10:00:00', 'INACTIVO'), // ruta inactiva
  ruta(112, 21, '10:00:00'), // centro inactivo
];

export interface MarcacionCruda {
  rutcon: number;
  datevia: string;
  lat: number;
  lon: number;
}

/** Comuna que el catálogo oficial (PostGIS) devolvería para el punto en error (stub de prueba). */
export const COMUNA_OFICIAL_PUNTO_ERROR = 'TALAGANTE';

export const MARCACIONES: MarcacionCruda[] = [
  { rutcon: C1, datevia: '2026-09-30T11:02:10-03:00', lat: -33.59, lon: -70.635 },
  { rutcon: C2, datevia: '2026-09-30T11:14:00-03:00', lat: -33.595, lon: -70.625 },
  { rutcon: C1, datevia: '2026-09-30T11:15:25-03:00', lat: -33.58705, lon: -70.9999 },
  { rutcon: C9989123, datevia: '2026-09-30T11:17:59-03:00', lat: -33.54, lon: -70.625 },
  { rutcon: C2, datevia: '2026-09-30T11:25:00-03:00', lat: -33.565, lon: -70.613 },
  { rutcon: C9989123, datevia: '2026-09-30T11:28:00-03:00', lat: -33.5651, lon: -70.6131 },
  { rutcon: C9867923, datevia: '2026-09-30T12:02:25-03:00', lat: -33.57691, lon: -70.64935 },
  { rutcon: C10362399, datevia: '2026-09-30T12:10:00-03:00', lat: -33.6, lon: -70.58 },
  { rutcon: C9867923, datevia: '2026-09-30T12:32:44-03:00', lat: -33.565, lon: -70.613 },
  { rutcon: C10362399, datevia: '2026-09-30T12:40:00-03:00', lat: -33.61, lon: -70.575 },
  { rutcon: C10362399, datevia: '2026-09-30T13:41:00-03:00', lat: -33.58, lon: -70.63 },
  { rutcon: C10362399, datevia: '2026-09-30T13:55:00-03:00', lat: -33.5649, lon: -70.6129 },
];

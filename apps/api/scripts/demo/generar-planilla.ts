/**
 * Genera db/dev/MODELO_DATOS_DEMO.xlsx con el formato de MODELO_DATOS_MUESTRAS_2 (SOLO DESARROLLO).
 * Incluye la hoja VIAJE para comprobar que el importador la ignora (RF-16) y los encabezados
 * DATCRE y «USRACT 2» de la planilla del cliente para comprobar su normalización (HAL-10).
 *
 *   pnpm --filter @gm/api demo:planilla
 */
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import {
  CENTROS_DEMO,
  CONDUCTORES_DEMO,
  LABORATORIOS_DEMO,
  MARCACIONES_DEMO,
  RUTAS_DEMO,
} from './escenario-demo.ts';

const destino = fileURLToPath(
  new URL('../../../../db/dev/MODELO_DATOS_DEMO.xlsx', import.meta.url),
);
const libro = new ExcelJS.Workbook();
libro.creator = 'Tech Analytic Solutions (datos sintéticos)';
libro.created = new Date('2026-11-24T12:00:00Z');

const hoja = (nombre: string, encabezados: string[], filas: unknown[][]) => {
  const ws = libro.addWorksheet(nombre);
  ws.addRow(encabezados).font = { bold: true };
  filas.forEach((f) => ws.addRow(f));
  ws.columns.forEach((c) => (c.width = 14));
};

hoja(
  'CENTRO',
  [
    'CODEMP',
    'CODCEN',
    'COMCEN',
    'DESCEN',
    'ALICEN',
    'DIRCEN',
    'LATCEN',
    'LONCEN',
    'RADCEN',
    'LUN',
    'MAR',
    'MIE',
    'JUE',
    'VIE',
    'SAB',
    'DOM',
    'CODLAB',
  ],
  CENTROS_DEMO.map((c) => [
    'EMP1',
    c.codcen,
    c.comcen,
    c.alicen,
    c.alicen.slice(0, 40),
    '',
    c.lat,
    c.lon,
    c.radcen,
    c.dias[1],
    c.dias[2],
    c.dias[3],
    c.dias[4],
    c.dias[5],
    c.dias[6],
    c.dias[7],
    c.codlab,
  ]),
);
hoja(
  'LABORATORIO',
  ['CODEMP', 'CODLAB', 'COMLAB', 'DESLAB', 'ALILAB', 'DIRLAB', 'LATLAB', 'LONLAB', 'RADLAB'],
  LABORATORIOS_DEMO.map((l) => [
    'EMP1',
    l.codlab,
    l.comlab,
    l.alilab,
    l.alilab,
    '',
    l.lat,
    l.lon,
    l.radlab,
  ]),
);
hoja(
  'CONDUCTOR',
  [
    'CODEMP',
    'RUTCON',
    'DVECON',
    'NOMCON',
    'PRIAPECON',
    'SEGAPECON',
    'ALICON',
    'CELCON',
    'EMAILCON',
  ],
  CONDUCTORES_DEMO.map((c) => [
    'EMP1',
    c.rutcon,
    c.dvecon,
    c.nomcon,
    c.priapecon,
    '',
    c.nomcon,
    Number(c.celular9),
    '',
  ]),
);
hoja(
  'RUTA CONDUCTOR',
  ['CODEMP', 'RUTCON', 'HORRUT', 'CODCEN', 'ESTRUT', 'DATCRE', 'USRACT 2'],
  RUTAS_DEMO.map((r) => [
    'EMP1',
    r.rutcon,
    Number(r.horrut.replaceAll(':', '')),
    r.codcen,
    r.estrut,
    '',
    '',
  ]),
);
hoja(
  'VIAJE',
  ['CODEMP', 'DATEVIA', 'RUTCON', 'LATVIA', 'LONVIA'],
  MARCACIONES_DEMO.map((m) => ['EMP1', m.datevia, m.rutcon, m.lat, m.lon]),
);

await libro.xlsx.writeFile(destino);
console.log(`Planilla de demostración: ${destino}`);

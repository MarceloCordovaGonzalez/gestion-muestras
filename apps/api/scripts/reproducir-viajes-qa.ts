/**
 * Reproduce la hoja VIAJE de la planilla del cliente contra la API de QA (solo QA; RF-16).
 * Cada fila se envía como POST /v1/marcaciones y se compara el resultado con la planilla.
 *
 * Uso:
 *   API_URL=https://.../v1 QA_TOKEN_<RUTCON>=<jwt del conductor de prueba> \
 *   pnpm --filter @gm/api exec node --import @swc-node/register/esm-register \
 *     scripts/reproducir-viajes-qa.ts ../../db/qa/MODELO_DATOS_MUESTRAS_2.xlsx
 */
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { normalizarEncabezado } from '@gm/domain';

const [archivo] = process.argv.slice(2);
const api = process.env['API_URL'];
if (!archivo || !api) {
  console.error('Uso: API_URL=... reproducir-viajes-qa.ts <planilla.xlsx>');
  process.exit(1);
}
if (/prod/i.test(api)) {
  console.error('Este script no puede ejecutarse contra producción (reparo RF-16).');
  process.exit(1);
}

const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(archivo);
const hoja = libro.worksheets.find((w) => w.name.trim().toUpperCase() === 'VIAJE');
if (!hoja) throw new Error('La planilla no contiene la hoja VIAJE.');

const encabezados = (hoja.getRow(1).values as unknown[]).slice(1).map(normalizarEncabezado);
const diferencias: string[] = [];
let enviados = 0;

for (let n = 2; n <= hoja.rowCount; n++) {
  const valores = (hoja.getRow(n).values as unknown[]).slice(1);
  if (valores.every((v) => v === null || v === undefined || String(v).trim() === '')) continue;
  const f = Object.fromEntries(encabezados.map((k, i) => [k, valores[i]]));
  const rutcon = Number(f['RUTCON']);
  const token = process.env[`QA_TOKEN_${rutcon}`];
  if (!token) {
    diferencias.push(`Fila ${n}: sin token QA_TOKEN_${rutcon}; omitida.`);
    continue;
  }
  const datevia = new Date(f['DATEVIA'] as string | Date).toISOString();
  const r = await fetch(`${api}/marcaciones`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      idvia: randomUUID(),
      datevia,
      lat: Number(f['LATVIA']),
      lon: Number(f['LONVIA']),
      precision: 0,
      origen: 'SIN_CONEXION',
      appVersion: 'qa-replay',
    }),
  });
  enviados++;
  const c = (await r.json()) as {
    estvia?: string;
    tipvia?: string | null;
    comuna?: string;
    codigo?: string;
  };
  if (!r.ok) {
    diferencias.push(`Fila ${n}: HTTP ${r.status} ${c.codigo ?? ''}`);
    continue;
  }
  const esperado = {
    estvia: String(f['ESTVIA'] ?? '').trim(),
    tipvia: String(f['TIPVIA'] ?? '').trim() || null,
    comuna: String(f['COMUNA'] ?? '').trim(),
  };
  for (const k of ['estvia', 'tipvia', 'comuna'] as const) {
    if ((c[k] ?? null) !== (esperado[k] ?? null)) {
      diferencias.push(`Fila ${n} (${datevia}): ${k} planilla=«${esperado[k]}» sistema=«${c[k]}»`);
    }
  }
}

console.log(`Filas enviadas: ${enviados}`);
console.log(
  diferencias.length ? `Diferencias:\n- ${diferencias.join('\n- ')}` : 'Sin diferencias.',
);

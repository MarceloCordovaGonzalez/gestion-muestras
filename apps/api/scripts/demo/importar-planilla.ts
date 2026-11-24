/**
 * Importa una planilla por la API (CU-05: validar → confirmar). SOLO DESARROLLO / CI.
 *
 *   pnpm --filter @gm/api demo:importar [ruta.xlsx]
 *   (por defecto db/dev/MODELO_DATOS_DEMO.xlsx; API en API_URL o http://localhost:8080/v1)
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env['API_URL'] ?? 'http://localhost:8080/v1';
const TOKEN_ADMIN = 'dev:ADMINISTRADOR:EMP1';
const archivo =
  process.argv[2] ??
  fileURLToPath(new URL('../../../../db/dev/MODELO_DATOS_DEMO.xlsx', import.meta.url));

const fd = new FormData();
fd.append('archivo', new Blob([readFileSync(archivo)]), basename(archivo));
const r = await fetch(`${API}/importaciones`, {
  method: 'POST',
  headers: { authorization: `Bearer ${TOKEN_ADMIN}` },
  body: fd,
});
const resumen = (await r.json()) as {
  idimp?: string;
  conteo?: Record<string, number>;
  errores?: { hoja: string; fila: number | null; mensaje: string }[];
  avisos?: string[];
  message?: unknown;
};
if (!r.ok || !resumen.idimp) {
  console.error(`Validación rechazada (HTTP ${r.status}):`, JSON.stringify(resumen, null, 2));
  process.exit(1);
}
console.log('Registros por hoja:', resumen.conteo);
resumen.avisos?.forEach((a) => console.log('Aviso:', a));
if (resumen.errores && resumen.errores.length > 0) {
  console.error('Errores de validación:');
  resumen.errores.forEach((e) => console.error(` - ${e.hoja} fila ${e.fila ?? '—'}: ${e.mensaje}`));
  process.exit(1);
}
const c = await fetch(`${API}/importaciones/${resumen.idimp}/confirmar`, {
  method: 'POST',
  headers: { authorization: `Bearer ${TOKEN_ADMIN}` },
});
console.log(`Confirmación: HTTP ${c.status}`, await c.text());
if (!c.ok) process.exit(1);

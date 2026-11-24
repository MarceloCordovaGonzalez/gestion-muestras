/**
 * Simula la jornada del 30/09/2026 contra la API (SOLO DESARROLLO / CI, requiere AUTH_DEV_BYPASS):
 *   1. genera los retiros planificados del día (RN-08, RN-14);
 *   2. enrola un dispositivo por conductor (CU-01);
 *   3. envía las 12 marcaciones del escenario como sincronización sin conexión (CU-02, RF-08);
 *   4. compara el dashboard con los valores esperados de la especificación (CU-04).
 *
 *   pnpm --filter @gm/api demo:simular [--verificar]
 *
 * Es idempotente: los IDVIA son deterministas, por lo que repetirla no duplica marcaciones.
 */
import { createHash } from 'node:crypto';
import { CONDUCTORES_DEMO, ESPERADO_30_09, FECHA, MARCACIONES_DEMO } from './escenario-demo.ts';

const API = process.env['API_URL'] ?? 'http://localhost:8080/v1';
const ADMIN = { authorization: 'Bearer dev:ADMINISTRADOR:EMP1' };
const verificar = process.argv.includes('--verificar');

async function llamar<T>(
  metodo: string,
  ruta: string,
  headers: Record<string, string>,
  cuerpo?: unknown,
): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { ...headers, ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta} → HTTP ${r.status}: ${texto}`);
  return JSON.parse(texto) as T;
}

/** UUID v4 determinista (idempotencia de la simulación). */
function uuidDeterminista(semilla: string): string {
  const h = createHash('sha256').update(semilla).digest('hex').split('');
  h[12] = '4';
  h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

// 1. Planificación del día
const plan = await llamar<{ generados: number }>(
  'POST',
  `/planificacion/generar?fecha=${FECHA}`,
  ADMIN,
);
console.log(`Retiros planificados generados para ${FECHA}: ${plan.generados}`);

// 2. Enrolamiento de los conductores que marcan
const tokens = new Map<number, string>();
for (const rutcon of new Set(MARCACIONES_DEMO.map((m) => m.rutcon))) {
  const c = CONDUCTORES_DEMO.find((x) => x.rutcon === rutcon)!;
  const r = await llamar<{ rutcon: number; iddis: string }>(
    'POST',
    '/auth/dispositivos',
    { authorization: `Bearer dev:CONDUCTOR:EMP1:::${c.celularE164}` },
    { idinst: `simulacion-${rutcon}`, modelo: 'simulador', so: 'node' },
  );
  tokens.set(rutcon, `dev:CONDUCTOR:EMP1:${r.rutcon}:${r.iddis}`);
}
console.log(`Dispositivos enrolados: ${tokens.size}`);

// 3. Marcaciones
console.log('\nHora      Conductor   Resultado');
for (const [i, m] of MARCACIONES_DEMO.entries()) {
  const c = await llamar<{
    hora: string;
    tipvia: string | null;
    estvia: string;
    comuna: string;
    fueraDeRuta: boolean;
    punto: { alias: string } | null;
    repetida: boolean;
  }>(
    'POST',
    '/marcaciones',
    { authorization: `Bearer ${tokens.get(m.rutcon)!}` },
    {
      idvia: uuidDeterminista(`demo-${FECHA}-${i}`),
      datevia: m.datevia,
      lat: m.lat,
      lon: m.lon,
      precision: 8,
      origen: 'SIN_CONEXION',
      appVersion: 'simulador',
    },
  );
  const detalle =
    c.estvia === 'ERROR' ? `ERROR · ${c.comuna}` : `${c.tipvia} · ${c.punto?.alias} · ${c.comuna}`;
  console.log(
    `${c.hora}  ${String(m.rutcon).padEnd(10)}  ${detalle}${c.fueraDeRuta ? ' · FUERA DE RUTA' : ''}${c.repetida ? ' (ya registrada)' : ''}`,
  );
}

// 4. Dashboard
const d = await llamar<Record<string, number | null | string>>(
  'GET',
  `/dashboard/detalle?fecha=${FECHA}`,
  ADMIN,
);
console.log(`\nDashboard ${String(d['cabecera'])}`);
let diferencias = 0;
for (const [k, esperado] of Object.entries(ESPERADO_30_09)) {
  const ok = d[k] === esperado;
  if (!ok) diferencias++;
  console.log(
    `  ${ok ? '✔' : '✘'} ${k.padEnd(22)} ${String(d[k]).padStart(5)}   (esperado ${esperado})`,
  );
}
const mapa = await llamar<{ tipo: string; codigo: number | null; cantidad: number }[]>(
  'GET',
  `/mapa?fecha=${FECHA}`,
  ADMIN,
);
const lab16 = mapa.find((p) => p.tipo === 'E' && p.codigo === 16)?.cantidad ?? 0;
console.log(
  `  ${lab16 === 4 ? '✔' : '✘'} mapa: entregas en el laboratorio 16 = ${lab16} (esperado 4)`,
);
if (lab16 !== 4) diferencias++;

if (verificar && diferencias > 0) {
  console.error(`\n${diferencias} diferencia(s) con la especificación.`);
  process.exit(1);
}
console.log(diferencias === 0 ? '\nResultado: coincide con la Especificación Funcional v1.4.' : '');

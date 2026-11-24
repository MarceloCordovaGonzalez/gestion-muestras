/**
 * Escenario de demostración (SOLO DESARROLLO): el escenario sintético del 30/09/2026 de las
 * pruebas de dominio, con RUT y celulares válidos para la importación (CU-05, RN-01, HAL-10).
 */
import {
  CENTROS,
  LABORATORIOS,
  MARCACIONES,
  RUTAS,
} from '../../../../packages/domain/test/fixtures/escenario-30-09-2026.ts';
import { calcularDigitoVerificador } from '../../../../packages/domain/src/identificacion.ts';

export { FECHA } from '../../../../packages/domain/test/fixtures/escenario-30-09-2026.ts';

/** RUT de las pruebas (1, 2, 100…) → RUT válidos de demostración. */
const RUT_DEMO: Record<number, number> = { 1: 12_345_678, 2: 11_111_111 };
export const rutDemo = (rutcon: number): number =>
  RUT_DEMO[rutcon] ?? (rutcon < 1_000_000 ? 15_000_000 + rutcon : rutcon);

/** Centros activos (el importador no carga estado; el centro inactivo del escenario se omite). */
export const CENTROS_DEMO = CENTROS.filter((c) => c.estcen === 'ACTIVO');
export const LABORATORIOS_DEMO = LABORATORIOS;
export const RUTAS_DEMO = RUTAS.filter((r) => CENTROS_DEMO.some((c) => c.codcen === r.codcen)).map(
  (r) => ({ ...r, rutcon: rutDemo(r.rutcon) }),
);

const rutsOriginales = [...new Set([...RUTAS, ...MARCACIONES].map((x) => x.rutcon))].sort(
  (a, b) => a - b,
);

export interface ConductorDemo {
  rutcon: number;
  dvecon: string;
  nomcon: string;
  priapecon: string;
  celular9: string; // como en la planilla del cliente (9 dígitos)
  celularE164: string;
}

export const CONDUCTORES_DEMO: ConductorDemo[] = rutsOriginales.map((orig, i) => {
  const rutcon = rutDemo(orig);
  const celular9 = `9123400${String(i + 1).padStart(2, '0')}`;
  return {
    rutcon,
    dvecon: calcularDigitoVerificador(rutcon),
    nomcon: `Conductor${i + 1}`,
    priapecon: 'Demo',
    celular9,
    celularE164: `+56${celular9}`,
  };
});

export const MARCACIONES_DEMO = MARCACIONES.map((m) => ({ ...m, rutcon: rutDemo(m.rutcon) }));

/** Valores esperados del dashboard del 30/09/2026 (Especificación Funcional v1.4, 6.4). */
export const ESPERADO_30_09 = {
  retirosPlanificados: 15,
  retirosRealizados: 6,
  entregasRealizadas: 5,
  errores: 1,
  porcentajeRetiros: 40,
  porcentajeErrores: 6.7,
  retirosFueraDeRuta: 2,
} as const;

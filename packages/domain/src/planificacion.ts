import { diaSemana } from './tiempo.ts';
import type { Centro, RutaConductor } from './tipos.ts';

export interface RetiroPlanificado {
  fecpla: string;
  idrut: string;
  rutcon: number;
  codcen: number;
  horpla: string;
}

/** ¿La ruta está vigente en la fecha (YYYY-MM-DD)? */
export function rutaVigente(ruta: RutaConductor, fecha: string): boolean {
  if (ruta.estrut !== 'ACTIVO') return false;
  if (ruta.vigdes && fecha < ruta.vigdes) return false;
  if (ruta.vighas && fecha > ruta.vighas) return false;
  return true;
}

/**
 * ¿La ruta aplica en la fecha? Ruta ACTIVA y vigente, centro ACTIVO con «S» en el día de la semana
 * y, si la ruta tiene DIASEM (MVP2), que coincida.
 */
export function rutaAplicaEnFecha(
  ruta: RutaConductor,
  centro: Centro | undefined,
  fecha: string,
): boolean {
  if (!centro || centro.estcen !== 'ACTIVO') return false;
  if (!rutaVigente(ruta, fecha)) return false;
  const dia = diaSemana(fecha);
  if (centro.dias[dia] !== 'S') return false;
  if (ruta.diasem !== null && ruta.diasem !== dia) return false;
  return true;
}

/**
 * RN-08 y RN-14: genera los retiros planificados de una fecha, excluyendo feriados.
 * Anticipado al MVP1 por decisión del cliente del 30/10/2026.
 */
export function generarRetirosPlanificados(
  fecha: string,
  rutas: readonly RutaConductor[],
  centros: readonly Centro[],
  feriados: ReadonlySet<string> = new Set(),
): RetiroPlanificado[] {
  if (feriados.has(fecha)) return [];
  const porCodigo = new Map(centros.map((c) => [c.codcen, c]));
  return rutas
    .filter((r) => rutaAplicaEnFecha(r, porCodigo.get(r.codcen), fecha))
    .map((r) => ({
      fecpla: fecha,
      idrut: r.idrut,
      rutcon: r.rutcon,
      codcen: r.codcen,
      horpla: r.horrut,
    }));
}

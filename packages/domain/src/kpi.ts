import { diasDelMes, etiquetaDia, fechaLocal } from './tiempo.ts';
import type { Viaje } from './tipos.ts';

export interface DetalleDiario {
  fecha: string;
  /** Cuadro 1 (RN-08). */
  retirosPlanificados: number;
  /** Cuadro 2 (RN-09). */
  retirosRealizados: number;
  /** Cuadro 3 (RN-10). */
  entregasRealizadas: number;
  /** Cuadro 4 (RN-11). */
  errores: number;
  /** Cuadro 5 (RN-12). null = «—». */
  porcentajeRetiros: number | null;
  /** Cuadro 6 (RN-13). null = «—». */
  porcentajeErrores: number | null;
  /** Cuadro 7 (RN-21). */
  retirosFueraDeRuta: number;
}

const redondear1 = (v: number): number => Math.round(v * 10) / 10;

const porcentaje = (numerador: number, denominador: number): number | null =>
  denominador === 0 ? null : redondear1((numerador / denominador) * 100);

/** Viajes cuya fecha local (America/Santiago) es la indicada. */
export function viajesDeLaFecha<T extends Pick<Viaje, 'datevia'>>(
  viajes: readonly T[],
  fecha: string,
): T[] {
  return viajes.filter((v) => fechaLocal(v.datevia) === fecha);
}

/**
 * RN-09 a RN-13 y RN-21. El filtro opcional por comuna usa el campo COMUNA, que incluye los
 * errores (RN-17).
 */
export function calcularDetalleDiario(
  fecha: string,
  viajes: readonly Viaje[],
  retirosPlanificados: number,
  comuna?: string,
): DetalleDiario {
  const delDia = viajesDeLaFecha(viajes, fecha).filter((v) => !comuna || v.comuna === comuna);
  const retirosRealizados = delDia.filter(
    (v) => v.estvia === 'CORRECTO' && v.tipvia === 'R',
  ).length;
  const entregasRealizadas = delDia.filter(
    (v) => v.estvia === 'CORRECTO' && v.tipvia === 'E',
  ).length;
  const errores = delDia.filter((v) => v.estvia === 'ERROR').length;
  const retirosFueraDeRuta = delDia.filter(
    (v) => v.estvia === 'CORRECTO' && v.tipvia === 'R' && v.fueraruta === 'S',
  ).length;

  return {
    fecha,
    retirosPlanificados,
    retirosRealizados,
    entregasRealizadas,
    errores,
    porcentajeRetiros: porcentaje(retirosRealizados, retirosPlanificados),
    porcentajeErrores: porcentaje(errores, retirosPlanificados),
    retirosFueraDeRuta,
  };
}

export interface PuntoTendencia {
  fecha: string;
  etiqueta: string;
  retiros: number;
  entregas: number;
  /** Propuesta: marcar con triángulo naranja los días con retiros fuera de ruta. */
  conFueraDeRuta: boolean;
}

/** RF-13: tendencia diaria de retiros y entregas CORRECTOS del mes. */
export function calcularTendenciaMensual(
  anio: number,
  mes: number,
  viajes: readonly Viaje[],
  comuna?: string,
): PuntoTendencia[] {
  const porFecha = new Map<string, Viaje[]>();
  for (const v of viajes) {
    if (comuna && v.comuna !== comuna) continue;
    const f = fechaLocal(v.datevia);
    (porFecha.get(f) ?? porFecha.set(f, []).get(f)!).push(v);
  }
  return diasDelMes(anio, mes).map((fecha) => {
    const dia = porFecha.get(fecha) ?? [];
    const correctos = dia.filter((v) => v.estvia === 'CORRECTO');
    return {
      fecha,
      etiqueta: etiquetaDia(fecha),
      retiros: correctos.filter((v) => v.tipvia === 'R').length,
      entregas: correctos.filter((v) => v.tipvia === 'E').length,
      conFueraDeRuta: correctos.some((v) => v.tipvia === 'R' && v.fueraruta === 'S'),
    };
  });
}

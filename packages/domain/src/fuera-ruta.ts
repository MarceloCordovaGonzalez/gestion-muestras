import { rutaAplicaEnFecha } from './planificacion.ts';
import type { Centro, EstadoViaje, IndicadorSN, RutaConductor, TipoViaje } from './tipos.ts';

export interface EntradaFueraRuta {
  tipvia: TipoViaje | null;
  estvia: EstadoViaje;
  codcen: number | null;
  rutcon: number;
  /** Fecha local (America/Santiago) de la marcación. */
  fecha: string;
}

/**
 * RN-21: un retiro CORRECTO es fuera de ruta cuando el conductor no tiene una ruta ACTIVA y vigente
 * para ese centro en el día de la semana de la marcación. Nunca se rechaza (ADR-11).
 * Entregas y errores no se evalúan: 'N'.
 */
export function evaluarFueraDeRuta(
  entrada: EntradaFueraRuta,
  rutasDelConductor: readonly RutaConductor[],
  centros: readonly Centro[],
): IndicadorSN {
  if (entrada.tipvia !== 'R' || entrada.estvia !== 'CORRECTO' || entrada.codcen === null) {
    return 'N';
  }
  const centro = centros.find((c) => c.codcen === entrada.codcen);
  const tieneRuta = rutasDelConductor.some(
    (r) =>
      r.rutcon === entrada.rutcon &&
      r.codcen === entrada.codcen &&
      rutaAplicaEnFecha(r, centro, entrada.fecha),
  );
  return tieneRuta ? 'N' : 'S';
}

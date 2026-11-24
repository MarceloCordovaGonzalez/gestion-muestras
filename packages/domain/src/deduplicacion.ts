import type { TipoViaje, Viaje } from './tipos.ts';

export interface MarcacionClasificada {
  rutcon: number;
  datevia: string;
  tipvia: TipoViaje | null;
  codcen: number | null;
  codlab: number | null;
}

/**
 * RN-07 (MEJ-07, activa en el Piloto 1): dos marcaciones del mismo conductor en el mismo punto
 * identificado dentro de la ventana (10 min por defecto) se consideran duplicadas. Se conserva la
 * primera; la segunda solo se registra si el conductor lo confirma.
 *
 * Las marcaciones en ERROR no tienen punto identificado y no se deduplican.
 * Devuelve el viaje previo con el que se duplica, o null.
 */
export function buscarDuplicado(
  nueva: MarcacionClasificada,
  previasDelConductor: readonly Pick<
    Viaje,
    'idvia' | 'rutcon' | 'datevia' | 'tipvia' | 'codcen' | 'codlab' | 'estvia'
  >[],
  ventanaMinutos = 10,
): Pick<Viaje, 'idvia' | 'datevia'> | null {
  if (nueva.tipvia === null) return null;
  const t = new Date(nueva.datevia).getTime();
  const ventanaMs = ventanaMinutos * 60_000;
  const codigo = nueva.tipvia === 'R' ? nueva.codcen : nueva.codlab;

  for (const p of previasDelConductor) {
    if (p.rutcon !== nueva.rutcon || p.estvia !== 'CORRECTO' || p.tipvia !== nueva.tipvia) continue;
    const codigoPrevio = p.tipvia === 'R' ? p.codcen : p.codlab;
    if (codigoPrevio !== codigo) continue;
    const delta = Math.abs(t - new Date(p.datevia).getTime());
    if (delta <= ventanaMs) return { idvia: p.idvia, datevia: p.datevia };
  }
  return null;
}

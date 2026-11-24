import { fechaLocal } from './tiempo.ts';
import type { Centro, Viaje } from './tipos.ts';

/**
 * RN-16 / MEJ-18 – Retiros pendientes de entrega (replanteo de RF-21).
 *
 * ESTADO: PENDIENTE DE APROBACIÓN DEL CLIENTE. Desactivado en el Piloto 1 (MVP1) mediante el
 * indicador `pendientesEntrega`; su activación se evaluará para el MVP2.
 *
 * Un retiro R CORRECTO queda pendiente si, transcurrido el plazo (3 h por defecto), el mismo
 * conductor no registra una entrega E CORRECTA posterior, del mismo día, en el laboratorio de
 * destino del centro. Se calcula por consulta, sin vincular registros.
 */
export interface RetiroPendiente {
  idvia: string;
  rutcon: number;
  codcen: number;
  labDestino: number;
  datevia: string;
  minutosTranscurridos: number;
}

export interface EntregaLaboratorioDistinto {
  idviaEntrega: string;
  rutcon: number;
  codlabEntrega: number;
  labsDestinoPendientes: number[];
}

export function calcularPendientesDeEntrega(
  fecha: string,
  viajes: readonly Viaje[],
  centros: readonly Centro[],
  ahora: Date,
  plazoHoras = 3,
): RetiroPendiente[] {
  const destino = new Map(centros.map((c) => [c.codcen, c.codlab]));
  const delDia = viajes.filter((v) => v.estvia === 'CORRECTO' && fechaLocal(v.datevia) === fecha);
  const plazoMs = plazoHoras * 3_600_000;

  return delDia
    .filter((r) => r.tipvia === 'R' && r.codcen !== null)
    .filter((r) => ahora.getTime() - new Date(r.datevia).getTime() >= plazoMs)
    .filter((r) => {
      const lab = destino.get(r.codcen!);
      const tR = new Date(r.datevia).getTime();
      return !delDia.some(
        (e) =>
          e.tipvia === 'E' &&
          e.rutcon === r.rutcon &&
          e.codlab === lab &&
          new Date(e.datevia).getTime() > tR,
      );
    })
    .map((r) => ({
      idvia: r.idvia,
      rutcon: r.rutcon,
      codcen: r.codcen!,
      labDestino: destino.get(r.codcen!) ?? -1,
      datevia: r.datevia,
      minutosTranscurridos: Math.floor((ahora.getTime() - new Date(r.datevia).getTime()) / 60_000),
    }));
}

/** Entregas en un laboratorio distinto del de destino de los retiros previos sin entregar. */
export function detectarEntregaEnLaboratorioDistinto(
  entrega: Pick<Viaje, 'idvia' | 'rutcon' | 'datevia' | 'codlab' | 'tipvia' | 'estvia'>,
  viajesPreviosDelDia: readonly Viaje[],
  centros: readonly Centro[],
): EntregaLaboratorioDistinto | null {
  if (entrega.tipvia !== 'E' || entrega.estvia !== 'CORRECTO' || entrega.codlab === null) {
    return null;
  }
  const destino = new Map(centros.map((c) => [c.codcen, c.codlab]));
  const tE = new Date(entrega.datevia).getTime();
  const previos = viajesPreviosDelDia
    .filter((v) => v.rutcon === entrega.rutcon && v.estvia === 'CORRECTO')
    .filter((v) => new Date(v.datevia).getTime() < tE);

  const labsPendientes = new Set<number>();
  for (const r of previos.filter((v) => v.tipvia === 'R' && v.codcen !== null)) {
    const lab = destino.get(r.codcen!);
    if (lab === undefined) continue;
    const tR = new Date(r.datevia).getTime();
    const entregado = previos.some(
      (e) => e.tipvia === 'E' && e.codlab === lab && new Date(e.datevia).getTime() > tR,
    );
    if (!entregado) labsPendientes.add(lab);
  }
  if (labsPendientes.size === 0 || labsPendientes.has(entrega.codlab)) return null;
  return {
    idviaEntrega: entrega.idvia,
    rutcon: entrega.rutcon,
    codlabEntrega: entrega.codlab,
    labsDestinoPendientes: [...labsPendientes].sort((a, b) => a - b),
  };
}

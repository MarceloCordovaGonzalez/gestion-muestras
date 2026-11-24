import { distanciaMetros } from './geo.ts';
import type {
  Centro,
  Coordenada,
  EstadoViaje,
  Laboratorio,
  MotivoError,
  TipoViaje,
} from './tipos.ts';

/** Candidato a punto identificado (centro o laboratorio) con su distancia a la marcación. */
export interface Candidato {
  tipo: TipoViaje; // R = centro, E = laboratorio (RN-05)
  codigo: number;
  comuna: string;
  distancia: number;
  radio: number;
}

export interface OpcionesSeleccion {
  /**
   * RN-04 (propuesta): ante distancias equivalentes (diferencia < umbralEmpateM), priorizar un
   * centro planificado para el conductor. Si no se informa, se aplica solo la menor distancia.
   */
  codcenPlanificados?: ReadonlySet<number>;
  umbralEmpateM?: number;
}

/**
 * RN-02 y RN-03: candidatos dentro de su geocerca, buscando SIEMPRE en ambas listas (cu v1.1;
 * HAL-14: si no hay centro se continúa con laboratorios). Solo puntos ACTIVOS (RN-19).
 */
export function buscarCandidatos(
  marcacion: Coordenada,
  centros: readonly Centro[],
  laboratorios: readonly Laboratorio[],
  radioPorDefectoM = 100,
): Candidato[] {
  const candidatos: Candidato[] = [];

  for (const c of centros) {
    if (c.estcen !== 'ACTIVO') continue;
    const radio = c.radcen ?? radioPorDefectoM;
    const distancia = distanciaMetros(marcacion, c);
    if (distancia <= radio) {
      candidatos.push({ tipo: 'R', codigo: c.codcen, comuna: c.comcen, distancia, radio });
    }
  }

  for (const l of laboratorios) {
    if (l.estlab !== 'ACTIVO') continue;
    const radio = l.radlab ?? radioPorDefectoM;
    const distancia = distanciaMetros(marcacion, l);
    if (distancia <= radio) {
      candidatos.push({ tipo: 'E', codigo: l.codlab, comuna: l.comlab, distancia, radio });
    }
  }

  return candidatos;
}

/**
 * RN-04: con más de un candidato (de una o de ambas listas) se elige el punto más cercano
 * (decisión del cliente del 04/11/2026). Devuelve null si no hay candidatos.
 */
export function seleccionarPunto(
  candidatos: readonly Candidato[],
  opciones: OpcionesSeleccion = {},
): Candidato | null {
  if (candidatos.length === 0) return null;
  const ordenados = [...candidatos].sort((a, b) => a.distancia - b.distancia);
  const primero = ordenados[0]!;

  const { codcenPlanificados, umbralEmpateM = 5 } = opciones;
  if (codcenPlanificados && codcenPlanificados.size > 0) {
    const empatePlanificado = ordenados.find(
      (c) =>
        c.tipo === 'R' &&
        codcenPlanificados.has(c.codigo) &&
        c.distancia - primero.distancia < umbralEmpateM,
    );
    if (empatePlanificado) return empatePlanificado;
  }
  return primero;
}

export interface ResultadoGeovalidacion {
  tipvia: TipoViaje | null;
  estvia: EstadoViaje;
  codcen: number | null;
  codlab: number | null;
  /** Siempre informada (RN-22). */
  comuna: string;
  /** Distancia al punto identificado o, en error, al punto más cercano (metros, entero). */
  distancia: number | null;
  moterr: MotivoError | null;
  /** En error: alias del punto más cercano, para informar al conductor (flujo 6a del CU-02). */
  puntoMasCercano: { tipo: TipoViaje; codigo: number; distancia: number } | null;
}

/**
 * Clasificación de la marcación (RN-03, RN-04, RN-05, RN-22).
 *
 * @param comunaDelPunto comuna cuyo límite oficial contiene el punto marcado (o la más cercana),
 *   resuelta por PostGIS (ADR-09). Solo se usa cuando la marcación queda en ERROR.
 */
export function clasificarMarcacion(
  marcacion: Coordenada,
  centros: readonly Centro[],
  laboratorios: readonly Laboratorio[],
  comunaDelPunto: string,
  opciones: OpcionesSeleccion & { radioPorDefectoM?: number } = {},
): ResultadoGeovalidacion {
  const candidatos = buscarCandidatos(marcacion, centros, laboratorios, opciones.radioPorDefectoM);
  const punto = seleccionarPunto(candidatos, opciones);

  if (punto) {
    return {
      tipvia: punto.tipo,
      estvia: 'CORRECTO',
      codcen: punto.tipo === 'R' ? punto.codigo : null,
      codlab: punto.tipo === 'E' ? punto.codigo : null,
      comuna: punto.comuna,
      distancia: Math.round(punto.distancia),
      moterr: null,
      puntoMasCercano: null,
    };
  }

  const cercano = puntoMasCercano(marcacion, centros, laboratorios);
  if (!comunaDelPunto || comunaDelPunto.trim() === '') {
    throw new Error('RN-22: toda marcación debe tener comuna; comunaDelPunto vacía.');
  }
  return {
    tipvia: null,
    estvia: 'ERROR',
    codcen: null,
    codlab: null,
    comuna: comunaDelPunto,
    distancia: cercano ? Math.round(cercano.distancia) : null,
    moterr: 'FUERA_DE_GEOCERCA',
    puntoMasCercano: cercano
      ? { tipo: cercano.tipo, codigo: cercano.codigo, distancia: Math.round(cercano.distancia) }
      : null,
  };
}

/** Punto activo más cercano sin considerar radios (información del flujo 6a del CU-02). */
export function puntoMasCercano(
  marcacion: Coordenada,
  centros: readonly Centro[],
  laboratorios: readonly Laboratorio[],
): Candidato | null {
  let mejor: Candidato | null = null;
  for (const c of centros) {
    if (c.estcen !== 'ACTIVO') continue;
    const d = distanciaMetros(marcacion, c);
    if (!mejor || d < mejor.distancia) {
      mejor = { tipo: 'R', codigo: c.codcen, comuna: c.comcen, distancia: d, radio: c.radcen ?? 0 };
    }
  }
  for (const l of laboratorios) {
    if (l.estlab !== 'ACTIVO') continue;
    const d = distanciaMetros(marcacion, l);
    if (!mejor || d < mejor.distancia) {
      mejor = { tipo: 'E', codigo: l.codlab, comuna: l.comlab, distancia: d, radio: l.radlab ?? 0 };
    }
  }
  return mejor;
}

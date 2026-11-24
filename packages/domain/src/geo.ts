import type { Coordenada } from './tipos.ts';

/** Radio medio terrestre (IUGG) en metros. */
const RADIO_TIERRA_M = 6_371_008.8;

const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

/**
 * Distancia geodésica aproximada (fórmula de Haversine) en metros.
 *
 * La fuente de verdad en producción es PostGIS (`ST_Distance` sobre `geography`, elipsoide WGS84).
 * Esta función se usa en pruebas, en la estimación visual de la App (ADR-04) y como respaldo.
 * La diferencia con el elipsoide es inferior a 0,5 % a las distancias de una geocerca.
 */
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLon = aRadianes(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Límites de Chile continental (Especificación Funcional v1.4, 9.1). */
export function esCoordenadaChileContinental({ lat, lon }: Coordenada): boolean {
  return lat <= -17.5 && lat >= -56 && lon <= -66 && lon >= -76;
}

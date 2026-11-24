import { Injectable } from '@nestjs/common';
import { type Candidato, type ResultadoGeovalidacion, seleccionarPunto } from '@gm/domain';
import type { Tx } from '../../comun/prisma.service.js';

interface FilaCandidato {
  tipo: 'R' | 'E';
  codigo: number;
  comuna: string;
  distancia: number;
  radio: number;
}

/**
 * Geovalidación en el servidor (ADR-04). PostGIS resuelve las distancias con índice GiST
 * (Modelo de Arquitectura 8.2); la selección del punto aplica la regla de dominio RN-04.
 */
@Injectable()
export class GeovalidacionService {
  async clasificar(
    tx: Tx,
    codemp: string,
    lat: number,
    lon: number,
    radioDefectoM: number,
  ): Promise<ResultadoGeovalidacion> {
    const candidatos = await this.candidatos(tx, codemp, lat, lon, radioDefectoM);
    const punto = seleccionarPunto(candidatos);

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

    const [comuna, cercano] = await Promise.all([
      this.comunaDelPunto(tx, lat, lon),
      this.puntoMasCercano(tx, codemp, lat, lon),
    ]);
    return {
      tipvia: null,
      estvia: 'ERROR',
      codcen: null,
      codlab: null,
      comuna,
      distancia: cercano ? Math.round(cercano.distancia) : null,
      moterr: 'FUERA_DE_GEOCERCA',
      puntoMasCercano: cercano
        ? { tipo: cercano.tipo, codigo: cercano.codigo, distancia: Math.round(cercano.distancia) }
        : null,
    };
  }

  /** RN-03/RN-04: una sola consulta indexada sobre ambas listas, ordenada por distancia. */
  private candidatos(tx: Tx, codemp: string, lat: number, lon: number, radioDef: number) {
    return tx.$queryRaw<FilaCandidato[]>`
      WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography AS g)
      SELECT tipo, codigo, comuna, distancia, radio FROM (
        SELECT 'R' AS tipo, c.codcen AS codigo, c.comcen AS comuna,
               ST_Distance(c.geo, p.g) AS distancia, COALESCE(c.radcen, ${radioDef}) AS radio
        FROM centro c, p
        WHERE c.codemp = ${codemp} AND c.estcen = 'ACTIVO'
          AND ST_DWithin(c.geo, p.g, COALESCE(c.radcen, ${radioDef}))
        UNION ALL
        SELECT 'E', l.codlab, l.comlab, ST_Distance(l.geo, p.g), COALESCE(l.radlab, ${radioDef})
        FROM laboratorio l, p
        WHERE l.codemp = ${codemp} AND l.estlab = 'ACTIVO'
          AND ST_DWithin(l.geo, p.g, COALESCE(l.radlab, ${radioDef}))
      ) cand
      ORDER BY distancia
      LIMIT 5` as Promise<Candidato[]>;
  }

  /** RN-22 / ADR-09: comuna cuyo límite oficial contiene el punto; respaldo: la más cercana. */
  async comunaDelPunto(tx: Tx, lat: number, lon: number): Promise<string> {
    const [fila] = await tx.$queryRaw<{ comuna: string | null }[]>`
      WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326) AS g)
      SELECT COALESCE(
        (SELECT c.nomcom FROM comuna c, p WHERE ST_Contains(c.geom, p.g) LIMIT 1),
        (SELECT c.nomcom FROM comuna c, p ORDER BY c.geom <-> p.g LIMIT 1)
      ) AS comuna`;
    if (!fila?.comuna) {
      throw new Error('RN-22: el catálogo COMUNA está vacío; cargue los límites oficiales.');
    }
    return fila.comuna;
  }

  private async puntoMasCercano(tx: Tx, codemp: string, lat: number, lon: number) {
    const [fila] = await tx.$queryRaw<FilaCandidato[]>`
      WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${lon}::float8, ${lat}::float8), 4326)::geography AS g)
      SELECT * FROM (
        (SELECT 'R' AS tipo, codcen AS codigo, comcen AS comuna, ST_Distance(geo, p.g) AS distancia, radcen AS radio
           FROM centro, p WHERE codemp = ${codemp} AND estcen = 'ACTIVO' ORDER BY geo <-> p.g LIMIT 1)
        UNION ALL
        (SELECT 'E', codlab, comlab, ST_Distance(geo, p.g), radlab
           FROM laboratorio, p WHERE codemp = ${codemp} AND estlab = 'ACTIVO' ORDER BY geo <-> p.g LIMIT 1)
      ) x ORDER BY distancia LIMIT 1`;
    return fila ?? null;
  }
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { distanciaMetros, esCoordenadaChileContinental } from '../src/geo.ts';
import {
  buscarCandidatos,
  clasificarMarcacion,
  seleccionarPunto,
  type Candidato,
} from '../src/geovalidacion.ts';
import type { Centro, Laboratorio } from '../src/tipos.ts';
import {
  CENTROS,
  COMUNA_OFICIAL_PUNTO_ERROR,
  LABORATORIOS,
} from './fixtures/escenario-30-09-2026.ts';

const DIAS = { 1: 'S', 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'N', 7: 'N' } as const;

describe('Geodesia', () => {
  it('distancia nula entre el mismo punto', () => {
    assert.equal(distanciaMetros({ lat: -33.5, lon: -70.6 }, { lat: -33.5, lon: -70.6 }), 0);
  });
  it('centros 10 y 15 están a ~92 m', () => {
    const c10 = CENTROS.find((c) => c.codcen === 10)!;
    const c15 = CENTROS.find((c) => c.codcen === 15)!;
    assert.ok(Math.abs(distanciaMetros(c10, c15) - 92) < 1);
  });
  it('valida rango de Chile continental', () => {
    assert.equal(esCoordenadaChileContinental({ lat: -33.45, lon: -70.66 }), true);
    assert.equal(esCoordenadaChileContinental({ lat: 40.4, lon: -3.7 }), false);
  });
});

describe('CU-02 · RN-03 / RN-04 / RN-05 / RN-22', () => {
  it('Dada una marcación a 0 m del centro 1, entonces R, CORRECTO, CODCEN = 1 y LA PINTANA', () => {
    const r = clasificarMarcacion({ lat: -33.59, lon: -70.635 }, CENTROS, LABORATORIOS, 'X');
    assert.equal(r.tipvia, 'R');
    assert.equal(r.estvia, 'CORRECTO');
    assert.equal(r.codcen, 1);
    assert.equal(r.codlab, null);
    assert.equal(r.comuna, 'LA PINTANA');
    assert.equal(r.distancia, 0);
  });

  it('Dada la marcación de las 13:41 en las geocercas de 10 y 15, entonces se asigna el centro 10', () => {
    const r = clasificarMarcacion({ lat: -33.58, lon: -70.63 }, CENTROS, LABORATORIOS, 'X');
    assert.equal(r.codcen, 10);
    const candidatos = buscarCandidatos({ lat: -33.58, lon: -70.63 }, CENTROS, LABORATORIOS);
    assert.deepEqual(
      candidatos.map((c) => c.codigo).sort((a, b) => a - b),
      [10, 15],
    );
  });

  it('Dada una marcación en geocerca de un centro y de un laboratorio, entonces gana la menor distancia', () => {
    const centros: Centro[] = [
      {
        codcen: 1,
        alicen: 'C',
        comcen: 'A',
        lat: -33.5,
        lon: -70.6,
        radcen: 150,
        codlab: 9,
        dias: DIAS,
        estcen: 'ACTIVO',
      },
    ];
    const labs: Laboratorio[] = [
      {
        codlab: 9,
        alilab: 'L',
        comlab: 'B',
        lat: -33.5008,
        lon: -70.6,
        radlab: 150,
        estlab: 'ACTIVO',
      },
    ];
    // 0,0006° ≈ 67 m del centro y ≈ 22 m del laboratorio.
    const r = clasificarMarcacion({ lat: -33.5006, lon: -70.6 }, centros, labs, 'X');
    assert.equal(r.tipvia, 'E');
    assert.equal(r.codlab, 9);
    assert.equal(r.comuna, 'B');
  });

  it('HAL-14: sin coincidencia en centros, continúa con la búsqueda en laboratorios', () => {
    const r = clasificarMarcacion({ lat: -33.565, lon: -70.613 }, CENTROS, LABORATORIOS, 'X');
    assert.equal(r.tipvia, 'E');
    assert.equal(r.codlab, 16);
  });

  it('Dada una marcación fuera de toda geocerca, entonces ERROR con FUERA_DE_GEOCERCA y comuna del punto', () => {
    const r = clasificarMarcacion(
      { lat: -33.58705, lon: -70.9999 },
      CENTROS,
      LABORATORIOS,
      COMUNA_OFICIAL_PUNTO_ERROR,
    );
    assert.equal(r.estvia, 'ERROR');
    assert.equal(r.tipvia, null);
    assert.equal(r.moterr, 'FUERA_DE_GEOCERCA');
    assert.equal(r.comuna, COMUNA_OFICIAL_PUNTO_ERROR);
    assert.notEqual(r.comuna, 'LA FLORIDA'); // HAL-17
    assert.ok(r.puntoMasCercano);
    assert.ok((r.distancia ?? 0) > 30_000);
  });

  it('Dada una marcación a 491 m de un laboratorio con radio 100 m, entonces ERROR', () => {
    const lab = LABORATORIOS[0]!;
    const desplazado = {
      lat: lab.lat,
      lon: lab.lon + 491 / (111_320 * Math.cos((lab.lat * Math.PI) / 180)),
    };
    const r = clasificarMarcacion(desplazado, [], [lab], 'LA PINTANA');
    assert.equal(r.estvia, 'ERROR');
    assert.ok(Math.abs((r.distancia ?? 0) - 491) <= 2);
  });

  it('RN-22: nunca acepta una marcación en error sin comuna', () => {
    assert.throws(() => clasificarMarcacion({ lat: -34.5, lon: -71.5 }, CENTROS, LABORATORIOS, ''));
  });

  it('RN-02: usa el radio por defecto cuando RAD no está informado', () => {
    const c: Centro = {
      codcen: 1,
      alicen: 'C',
      comcen: 'A',
      lat: -33.5,
      lon: -70.6,
      radcen: null,
      codlab: 1,
      dias: DIAS,
      estcen: 'ACTIVO',
    };
    const p = { lat: -33.5 - 80 / 111_195, lon: -70.6 }; // 80 m
    assert.equal(buscarCandidatos(p, [c], [], 100).length, 1);
    assert.equal(buscarCandidatos(p, [c], [], 50).length, 0);
  });

  it('RN-19: centros y laboratorios inactivos no participan', () => {
    const r = clasificarMarcacion(
      { lat: -33.64, lon: -70.67 },
      CENTROS,
      LABORATORIOS,
      'LA PINTANA',
    );
    assert.equal(r.estvia, 'ERROR');
  });

  it('borde exacto del radio cuenta como dentro (≤)', () => {
    const cand: Candidato[] = [{ tipo: 'R', codigo: 1, comuna: 'A', distancia: 100, radio: 100 }];
    assert.equal(seleccionarPunto(cand)?.codigo, 1);
  });
});

describe('RN-04 · propuesta de desempate por planificación', () => {
  const cand: Candidato[] = [
    { tipo: 'R', codigo: 10, comuna: 'A', distancia: 40, radio: 100 },
    { tipo: 'R', codigo: 15, comuna: 'A', distancia: 43, radio: 100 },
  ];
  it('sin planificación gana la menor distancia', () => {
    assert.equal(seleccionarPunto(cand)?.codigo, 10);
  });
  it('con diferencia < 5 m prioriza el centro planificado', () => {
    assert.equal(seleccionarPunto(cand, { codcenPlanificados: new Set([15]) })?.codigo, 15);
  });
  it('con diferencia ≥ 5 m no cambia', () => {
    assert.equal(
      seleccionarPunto(cand, { codcenPlanificados: new Set([15]), umbralEmpateM: 2 })?.codigo,
      10,
    );
  });
  it('sin candidatos devuelve null', () => {
    assert.equal(seleccionarPunto([]), null);
  });
});

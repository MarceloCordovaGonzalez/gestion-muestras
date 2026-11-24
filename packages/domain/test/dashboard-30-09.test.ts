import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcularDetalleDiario, calcularTendenciaMensual } from '../src/kpi.ts';
import {
  calcularPendientesDeEntrega,
  detectarEntregaEnLaboratorioDistinto,
} from '../src/pendientes-entrega.ts';
import { generarRetirosPlanificados } from '../src/planificacion.ts';
import { C1, C9989123, C10362399, CENTROS, FECHA, RUTAS } from './fixtures/escenario-30-09-2026.ts';
import { procesarEscenario } from './fixtures/procesar.ts';

const viajes = procesarEscenario();
const planificados = generarRetirosPlanificados(FECHA, RUTAS, CENTROS);

describe('CU-04 · valores esperados del 30/09/2026 (Especificación v1.4, 6.4)', () => {
  const d = calcularDetalleDiario(FECHA, viajes, planificados.length);

  it('Cuadro 1 · retiros planificados = 15 (RN-08)', () => assert.equal(d.retirosPlanificados, 15));
  it('Cuadro 2 · retiros realizados = 6 (RN-09)', () => assert.equal(d.retirosRealizados, 6));
  it('Cuadro 3 · entregas realizadas = 5 (RN-10)', () => assert.equal(d.entregasRealizadas, 5));
  it('Cuadro 4 · errores = 1 (RN-11)', () => assert.equal(d.errores, 1));
  it('Cuadro 5 · % retiros = 40,0 (RN-12)', () => assert.equal(d.porcentajeRetiros, 40));
  it('Cuadro 6 · % errores = 6,7 (RN-13)', () => assert.equal(d.porcentajeErrores, 6.7));
  it('Cuadro 7 · retiros fuera de ruta = 2 (RN-21)', () => assert.equal(d.retirosFueraDeRuta, 2));
});

describe('RN-21 · retiros fuera de ruta', () => {
  it('conductor 9989123 en el centro 3 (tiene asignado el 4) → FUERARUTA = S', () => {
    const v = viajes.find((x) => x.rutcon === C9989123 && x.tipvia === 'R')!;
    assert.equal(v.codcen, 3);
    assert.equal(v.fueraruta, 'S');
  });
  it('conductor 10362399 en el centro 7 (sin ruta) → S; en el centro 10 → N', () => {
    const rs = viajes.filter((x) => x.rutcon === C10362399 && x.tipvia === 'R');
    assert.deepEqual(
      rs.map((r) => [r.codcen, r.fueraruta]),
      [
        [7, 'S'],
        [10, 'N'],
      ],
    );
  });
  it('entregas y errores siempre N', () => {
    assert.ok(viajes.filter((v) => v.tipvia !== 'R').every((v) => v.fueraruta === 'N'));
  });
});

describe('CU-03 · mapa', () => {
  it('el laboratorio 16 suma 4 entregas (bandera «4»)', () => {
    assert.equal(viajes.filter((v) => v.tipvia === 'E' && v.codlab === 16).length, 4);
  });
  it('RN-17 · el filtro por comuna incluye los errores', () => {
    const errorComuna = viajes.find((v) => v.estvia === 'ERROR')!.comuna;
    const d = calcularDetalleDiario(FECHA, viajes, 15, errorComuna);
    assert.equal(d.errores, 1);
  });
});

describe('RN-08 · casos de borde de planificación', () => {
  it('domingo sin retiros → planificados 0 y porcentajes «—» (null)', () => {
    const domingo = '2026-10-04';
    const p = generarRetirosPlanificados(domingo, RUTAS, CENTROS);
    const d = calcularDetalleDiario(domingo, viajes, p.length);
    assert.equal(d.retirosPlanificados, 0);
    assert.equal(d.porcentajeRetiros, null);
    assert.equal(d.porcentajeErrores, null);
  });
  it('feriado configurado → 0 planificados', () => {
    assert.equal(generarRetirosPlanificados(FECHA, RUTAS, CENTROS, new Set([FECHA])).length, 0);
  });
  it('vigencia de ruta y DIASEM (MVP2) se respetan', () => {
    const base = RUTAS[0]!;
    assert.equal(
      generarRetirosPlanificados(FECHA, [{ ...base, vighas: '2026-09-29' }], CENTROS).length,
      0,
    );
    assert.equal(
      generarRetirosPlanificados(FECHA, [{ ...base, vigdes: '2026-10-01' }], CENTROS).length,
      0,
    );
    assert.equal(generarRetirosPlanificados(FECHA, [{ ...base, diasem: 2 }], CENTROS).length, 0);
    assert.equal(generarRetirosPlanificados(FECHA, [{ ...base, diasem: 3 }], CENTROS).length, 1);
  });
});

describe('RF-13 · tendencia mensual', () => {
  const t = calcularTendenciaMensual(2026, 9, viajes);
  it('30 días con etiqueta «dd + número»', () => {
    assert.equal(t.length, 30);
    assert.equal(t[29]!.etiqueta, 'mi 30');
    assert.equal(t[0]!.etiqueta, 'ma 1');
  });
  it('el 30/09 registra 6 retiros, 5 entregas y fuera de ruta', () => {
    assert.deepEqual(
      { r: t[29]!.retiros, e: t[29]!.entregas, f: t[29]!.conFueraDeRuta },
      { r: 6, e: 5, f: true },
    );
  });
  it('filtro por comuna', () => {
    const pa = calcularTendenciaMensual(2026, 9, viajes, 'PUENTE ALTO');
    assert.equal(pa[29]!.retiros, 1);
  });
});

describe('RN-16 · pendientes de entrega (MEJ-18, desactivado en MVP1)', () => {
  it('al cierre del día solo queda pendiente el conductor 1 (CM Mariano Latorre, 11:02)', () => {
    const p = calcularPendientesDeEntrega(
      FECHA,
      viajes,
      CENTROS,
      new Date('2026-09-30T23:59:00-03:00'),
    );
    assert.equal(p.length, 1);
    assert.equal(p[0]!.rutcon, C1);
    assert.equal(p[0]!.codcen, 1);
    assert.equal(p[0]!.labDestino, 16);
  });
  it('antes de vencer el plazo no hay pendientes', () => {
    const p = calcularPendientesDeEntrega(
      FECHA,
      viajes,
      CENTROS,
      new Date('2026-09-30T12:00:00-03:00'),
    );
    assert.equal(p.length, 0);
  });
  it('detecta entrega en laboratorio distinto del de destino', () => {
    const previos = viajes.filter((v) => v.rutcon === C10362399 && v.datevia < '2026-09-30T12:40');
    const r = detectarEntregaEnLaboratorioDistinto(
      {
        idvia: 'x',
        rutcon: C10362399,
        datevia: '2026-09-30T12:40:00-03:00',
        codlab: 16,
        tipvia: 'E',
        estvia: 'CORRECTO',
      },
      previos,
      CENTROS,
    );
    assert.deepEqual(r?.labsDestinoPendientes, [17]);
  });
  it('entrega en el laboratorio correcto no se informa', () => {
    const previos = viajes.filter((v) => v.rutcon === C10362399 && v.datevia < '2026-09-30T12:40');
    const r = detectarEntregaEnLaboratorioDistinto(
      {
        idvia: 'x',
        rutcon: C10362399,
        datevia: '2026-09-30T12:40:00-03:00',
        codlab: 17,
        tipvia: 'E',
        estvia: 'CORRECTO',
      },
      previos,
      CENTROS,
    );
    assert.equal(r, null);
  });
  it('un retiro no es entrega', () => {
    assert.equal(
      detectarEntregaEnLaboratorioDistinto(
        {
          idvia: 'x',
          rutcon: 1,
          datevia: '2026-09-30T12:40:00-03:00',
          codlab: null,
          tipvia: 'R',
          estvia: 'CORRECTO',
        },
        [],
        CENTROS,
      ),
      null,
    );
  });
});

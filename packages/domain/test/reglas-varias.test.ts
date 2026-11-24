import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buscarDuplicado } from '../src/deduplicacion.ts';
import { INDICADORES_POR_DEFECTO, resolverIndicadores } from '../src/feature-flags.ts';
import {
  calcularDigitoVerificador,
  normalizarCelularChile,
  validarRut,
} from '../src/identificacion.ts';
import {
  clasificarHojas,
  normalizarEncabezado,
  normalizarHora,
  normalizarSN,
  vacioANull,
  validarEncabezados,
} from '../src/importacion.ts';
import { cabeceraFecha, diaSemana, fechaLocal, horaLocal, minutosDelDia } from '../src/tiempo.ts';

describe('RN-07 · deduplicación (MEJ-07, activa)', () => {
  const previa = {
    idvia: 'a',
    rutcon: 1,
    datevia: '2026-09-30T11:02:00-03:00',
    tipvia: 'R' as const,
    codcen: 1,
    codlab: null,
    estvia: 'CORRECTO' as const,
  };
  it('misma persona, mismo centro, 5 min después → duplicado', () => {
    const d = buscarDuplicado(
      { rutcon: 1, datevia: '2026-09-30T11:07:00-03:00', tipvia: 'R', codcen: 1, codlab: null },
      [previa],
    );
    assert.equal(d?.idvia, 'a');
  });
  it('11 minutos después → no duplicado', () => {
    assert.equal(
      buscarDuplicado(
        { rutcon: 1, datevia: '2026-09-30T11:13:01-03:00', tipvia: 'R', codcen: 1, codlab: null },
        [previa],
      ),
      null,
    );
  });
  it('otro centro u otro conductor → no duplicado', () => {
    assert.equal(
      buscarDuplicado(
        { rutcon: 1, datevia: '2026-09-30T11:05:00-03:00', tipvia: 'R', codcen: 2, codlab: null },
        [previa],
      ),
      null,
    );
    assert.equal(
      buscarDuplicado(
        { rutcon: 2, datevia: '2026-09-30T11:05:00-03:00', tipvia: 'R', codcen: 1, codlab: null },
        [previa],
      ),
      null,
    );
  });
  it('entrega en el mismo laboratorio', () => {
    const e = { ...previa, idvia: 'e', tipvia: 'E' as const, codcen: null, codlab: 16 };
    assert.equal(
      buscarDuplicado(
        { rutcon: 1, datevia: '2026-09-30T11:04:00-03:00', tipvia: 'E', codcen: null, codlab: 16 },
        [e],
      )?.idvia,
      'e',
    );
  });
  it('los errores no se deduplican', () => {
    assert.equal(
      buscarDuplicado(
        {
          rutcon: 1,
          datevia: '2026-09-30T11:03:00-03:00',
          tipvia: null,
          codcen: null,
          codlab: null,
        },
        [previa],
      ),
      null,
    );
  });
});

describe('Indicadores de funcionalidad', () => {
  it('por defecto: deduplicación activa y pendientes de entrega desactivado', () => {
    assert.deepEqual(INDICADORES_POR_DEFECTO, { deduplicacion: true, pendientesEntrega: false });
    assert.deepEqual(resolverIndicadores(), { deduplicacion: true, pendientesEntrega: false });
  });
  it('variables de entorno y parámetro por empresa (prioridad mayor)', () => {
    assert.equal(
      resolverIndicadores({ FEATURE_PENDIENTES_ENTREGA: 'true' }).pendientesEntrega,
      true,
    );
    assert.equal(resolverIndicadores({ FEATURE_DEDUPLICACION: 'false' }).deduplicacion, false);
    assert.equal(
      resolverIndicadores({ FEATURE_PENDIENTES_ENTREGA: 'true' }, { pendientesEntrega: false })
        .pendientesEntrega,
      false,
    );
  });
});

describe('RN-01 · RUT y celular', () => {
  it('dígito verificador módulo 11', () => {
    assert.equal(calcularDigitoVerificador(11_111_111), '1');
    assert.equal(calcularDigitoVerificador(12_345_678), '5');
    assert.equal(calcularDigitoVerificador(1), '9');
    assert.equal(validarRut(12_345_678, '5'), true);
    assert.equal(validarRut(12_345_678, 'k'), false);
    assert.equal(validarRut(-1, '0'), false);
  });
  it('dígito K y 0', () => {
    assert.equal(calcularDigitoVerificador(10_000_013), 'K');
    assert.equal(calcularDigitoVerificador(10_000_004), '0');
  });
  it('celular a E.164', () => {
    assert.equal(normalizarCelularChile(912345678), '+56912345678');
    assert.equal(normalizarCelularChile('+56 9 1234 5678'), '+56912345678');
    assert.equal(normalizarCelularChile('12345678'), '+56912345678');
    assert.equal(normalizarCelularChile('221234567'), null);
    assert.equal(normalizarCelularChile('123'), null);
  });
});

describe('CU-05 · importación (RF-16 con reparo)', () => {
  it('la hoja VIAJE se ignora', () => {
    const r = clasificarHojas([
      'CENTRO',
      'LABORATORIO',
      'CONDUCTOR',
      'RUTA CONDUCTOR',
      'VIAJE',
      'Hoja1',
    ]);
    assert.deepEqual(r.importables, ['CENTRO', 'LABORATORIO', 'CONDUCTOR', 'RUTA CONDUCTOR']);
    assert.deepEqual(r.ignoradas, ['VIAJE']);
    assert.deepEqual(r.desconocidas, ['Hoja1']);
  });
  it('HAL-18: encabezado CODEMP vacío en CENTRO se rechaza', () => {
    const enc = [
      '',
      'CODCEN',
      'COMCEN',
      'DESCEN',
      'ALICEN',
      'LATCEN',
      'LONCEN',
      'RADCEN',
      'LUN',
      'MAR',
      'MIE',
      'JUE',
      'VIE',
      'SAB',
      'DOM',
      'CODLAB',
    ];
    const errores = validarEncabezados('CENTRO', enc);
    assert.equal(errores.length, 2);
    assert.ok(errores.some((e) => e.columna === 1));
    assert.ok(errores.some((e) => e.mensaje.includes('CODEMP')));
  });
  it('encabezados completos no generan errores; alias normalizados', () => {
    assert.deepEqual(
      validarEncabezados('RUTA CONDUCTOR', [
        'EMPRESA',
        'RUTCON',
        'HORRUT',
        'CODCEN',
        'ESTRUT',
        'DATCRE',
        'USRACT 2',
      ]),
      [],
    );
    assert.equal(normalizarEncabezado(' datcre '), 'DATECRE');
    assert.equal(normalizarEncabezado('MIÉ'), 'MIE');
    assert.equal(normalizarEncabezado(null), '');
  });
  it('HORRUT numérica a hora', () => {
    assert.equal(normalizarHora(110000), '11:00:00');
    assert.equal(normalizarHora('93000'), '09:30:00');
    assert.equal(normalizarHora('9:30'), '09:30:00');
    assert.equal(normalizarHora(0.5), '12:00:00');
    assert.equal(normalizarHora(' '), null);
    assert.equal(normalizarHora('256000'), null);
    assert.equal(normalizarHora('25:00'), null);
    assert.equal(normalizarHora('abc'), null);
  });
  it('vacíos y S/N', () => {
    assert.equal(vacioANull(' '), null);
    assert.equal(vacioANull(undefined), null);
    assert.equal(vacioANull('x'), 'x');
    assert.equal(normalizarSN(' s'), 'S');
    assert.equal(normalizarSN('x'), null);
  });
});

describe('RN-06 / RNF-10 · zona horaria', () => {
  it('fecha local en America/Santiago aunque en UTC sea otro día', () => {
    assert.equal(fechaLocal('2026-10-01T02:30:00Z'), '2026-09-30');
    assert.equal(horaLocal('2026-09-30T14:02:25Z'), '11:02:25');
  });
  it('cambio de horario de abril (UTC−3 → UTC−4)', () => {
    assert.equal(horaLocal('2026-04-04T12:00:00Z'), '09:00:00');
    assert.equal(horaLocal('2026-04-06T12:00:00Z'), '08:00:00');
  });
  it('día de la semana y cabecera', () => {
    assert.equal(diaSemana('2026-09-30'), 3);
    assert.equal(diaSemana('2026-10-04'), 7);
    assert.equal(cabeceraFecha('2026-09-30'), '30/9/2026 Miércoles');
    assert.equal(minutosDelDia('11:30:30'), 690.5);
  });
  it('instante inválido lanza error', () => {
    assert.throws(() => fechaLocal('no-es-fecha'));
  });
});

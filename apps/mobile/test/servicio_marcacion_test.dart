import 'package:flutter_test/flutter_test.dart';
import 'package:gestion_muestras/datos/api_cliente.dart';
import 'package:gestion_muestras/datos/cola_local.dart';
import 'package:gestion_muestras/dominio/marcacion.dart';
import 'package:gestion_muestras/servicios/sincronizacion.dart';

/// API simulada: devuelve las respuestas programadas en orden y registra los envíos.
class ApiFalsa implements ApiMarcaciones {
  ApiFalsa(this.respuestas);
  final List<ResultadoEnvio Function(MarcacionPendiente)> respuestas;
  final enviados = <MarcacionPendiente>[];

  @override
  Future<ResultadoEnvio> enviar(MarcacionPendiente m) async {
    enviados.add(m);
    return respuestas.removeAt(0)(m);
  }
}

Confirmacion confirmacion(MarcacionPendiente m) => Confirmacion(
      idvia: m.idvia,
      fecha: '2026-09-30',
      hora: '12:02:25',
      tipvia: 'R',
      estvia: 'CORRECTO',
      comuna: 'LA PINTANA',
      fueraDeRuta: false,
    );

void main() {
  final hora = DateTime.parse('2026-09-30T15:02:25Z');

  test('en línea: confirma y vacía la cola', () async {
    final cola = ColaEnMemoria();
    final s = ServicioMarcacion(
        cola: cola, api: ApiFalsa([(m) => EnvioConfirmado(confirmacion(m))]));
    final r = await s.marcar(
        lat: -33.57691, lon: -70.64935, precision: 8, ahora: hora);
    expect(r, isA<MarcacionConfirmada>());
    expect(await cola.cantidad(), 0);
  });

  test(
      'RF-08: sin conexión queda pendiente y se sincroniza con el mismo IDVIA y hora original',
      () async {
    final cola = ColaEnMemoria();
    final api = ApiFalsa(
        [(_) => EnvioReintentable(), (m) => EnvioConfirmado(confirmacion(m))]);
    final s = ServicioMarcacion(cola: cola, api: api);

    final r =
        await s.marcar(lat: -33.5, lon: -70.6, precision: 12, ahora: hora);
    expect(r, isA<MarcacionPendienteDeEnvio>());
    expect(await cola.cantidad(), 1);

    expect(await s.sincronizar(), 1);
    expect(await cola.cantidad(), 0);
    expect(api.enviados[0].idvia, api.enviados[1].idvia); // idempotencia
    expect(api.enviados[1].datevia,
        hora); // RN-06: conserva la hora del dispositivo
    expect(api.enviados[1].origen, OrigenMarcacion.sinConexion);
  });

  test(
      'RN-07: posible duplicado requiere confirmación y se reenvía con confirmarDuplicado',
      () async {
    final cola = ColaEnMemoria();
    final api = ApiFalsa([
      (_) => EnvioPosibleDuplicado('¿Desea registrarla de todos modos?'),
      (m) => EnvioConfirmado(confirmacion(m)),
    ]);
    final s = ServicioMarcacion(cola: cola, api: api);
    final r = await s.marcar(lat: -33.5, lon: -70.6, precision: 5, ahora: hora);
    expect(r, isA<MarcacionRequiereConfirmacion>());

    final r2 =
        await s.confirmarDuplicado((r as MarcacionRequiereConfirmacion).idvia);
    expect(r2, isA<MarcacionConfirmada>());
    expect(api.enviados.last.aJson('t')['confirmarDuplicado'], true);
  });

  test(
      'rechazo definitivo (dispositivo revocado) se informa y no queda en la cola',
      () async {
    final cola = ColaEnMemoria();
    final s = ServicioMarcacion(
        cola: cola,
        api: ApiFalsa([(_) => EnvioRechazado(403, 'Dispositivo revocado')]));
    final r = await s.marcar(lat: -33.5, lon: -70.6, precision: 5, ahora: hora);
    expect(r, isA<MarcacionRechazada>());
    expect(await cola.cantidad(), 0);
  });

  test('JSON con hora local y zona horaria', () {
    final m = MarcacionPendiente(
      idvia: 'x',
      datevia: hora,
      lat: 1,
      lon: 2,
      precision: 3,
      origen: OrigenMarcacion.enLinea,
    );
    final datevia = m.aJson('0.1.0')['datevia']! as String;
    expect(DateTime.parse(datevia).toUtc(), hora);
    expect(RegExp(r'[+-]\d{2}:\d{2}$').hasMatch(datevia), isTrue);
  });
}

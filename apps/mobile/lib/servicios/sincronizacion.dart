import 'dart:async';

import 'package:uuid/uuid.dart';

import '../datos/api_cliente.dart';
import '../datos/cola_local.dart';
import '../dominio/marcacion.dart';

/// Resultado de «Marcar ahora» para la interfaz.
sealed class ResultadoMarcacion {}

class MarcacionConfirmada extends ResultadoMarcacion {
  MarcacionConfirmada(this.confirmacion);
  final Confirmacion confirmacion;
}

/// Flujo 2b del CU-02: sin conexión → «Marcación pendiente de envío».
class MarcacionPendienteDeEnvio extends ResultadoMarcacion {
  MarcacionPendienteDeEnvio(this.idvia);
  final String idvia;
}

/// Flujo 2c del CU-02 (RN-07): preguntar si desea registrarla de todos modos.
class MarcacionRequiereConfirmacion extends ResultadoMarcacion {
  MarcacionRequiereConfirmacion(this.idvia, this.mensaje);
  final String idvia;
  final String mensaje;
}

class MarcacionRechazada extends ResultadoMarcacion {
  MarcacionRechazada(this.mensaje);
  final String mensaje;
}

/// Orquesta la cola local y el envío (Modelo de Arquitectura 7.1):
/// 1. La marcación se guarda en la cola ANTES de enviarse.
/// 2. Se intenta el envío; si es transitorio, queda en la cola con su hora original.
/// 3. La sincronización reenvía con el mismo IDVIA (idempotente: sin duplicados en el servidor).
class ServicioMarcacion {
  ServicioMarcacion({required this.cola, required this.api, Uuid? uuid})
      : _uuid = uuid ?? const Uuid();

  final ColaLocal cola;
  final ApiMarcaciones api;
  final Uuid _uuid;
  bool _sincronizando = false;

  /// Notifica confirmaciones obtenidas en segundo plano (sincronización).
  final _confirmaciones = StreamController<Confirmacion>.broadcast();
  Stream<Confirmacion> get confirmaciones => _confirmaciones.stream;

  Future<ResultadoMarcacion> marcar({
    required double lat,
    required double lon,
    required int precision,
    DateTime? ahora,
  }) async {
    final m = MarcacionPendiente(
      idvia: _uuid.v4(),
      datevia: ahora ?? DateTime.now(),
      lat: lat,
      lon: lon,
      precision: precision,
      origen: OrigenMarcacion.enLinea,
    );
    await cola.encolar(m);
    return _enviarDesdeCola(m);
  }

  /// RN-07: el conductor confirma registrar el posible duplicado.
  Future<ResultadoMarcacion> confirmarDuplicado(String idvia) async {
    final m =
        (await cola.pendientes()).where((x) => x.idvia == idvia).firstOrNull;
    if (m == null) {
      return MarcacionRechazada('La marcación ya no está pendiente.');
    }
    final confirmada = m.copiar(confirmarDuplicado: true);
    await cola.actualizar(confirmada);
    return _enviarDesdeCola(confirmada);
  }

  /// El conductor desiste del posible duplicado: se descarta de la cola.
  Future<void> descartar(String idvia) => cola.eliminar(idvia);

  /// Reenvía las marcaciones pendientes (al recuperar conexión o al abrir la App).
  Future<int> sincronizar() async {
    if (_sincronizando) return 0;
    _sincronizando = true;
    var enviadas = 0;
    try {
      for (final m in await cola.pendientes()) {
        final r = await _enviarDesdeCola(
            m.copiar(origen: OrigenMarcacion.sinConexion));
        if (r is MarcacionConfirmada) {
          enviadas++;
          _confirmaciones.add(r.confirmacion);
        } else if (r is MarcacionPendienteDeEnvio) {
          break; // sigue sin conexión: se reintentará más tarde
        }
      }
    } finally {
      _sincronizando = false;
    }
    return enviadas;
  }

  Future<ResultadoMarcacion> _enviarDesdeCola(MarcacionPendiente m) async {
    final r = await api.enviar(m);
    switch (r) {
      case EnvioConfirmado(:final confirmacion):
        await cola.eliminar(m.idvia);
        return MarcacionConfirmada(confirmacion);
      case EnvioPosibleDuplicado(:final mensaje):
        return MarcacionRequiereConfirmacion(m.idvia, mensaje);
      case EnvioRechazado(:final mensaje):
        await cola.eliminar(m.idvia);
        return MarcacionRechazada(mensaje);
      case EnvioReintentable():
        await cola.actualizar(m.copiar(
            origen: OrigenMarcacion.sinConexion, intentos: m.intentos + 1));
        return MarcacionPendienteDeEnvio(m.idvia);
    }
  }

  Future<void> cerrar() => _confirmaciones.close();
}

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../dominio/marcacion.dart';

/// Resultado del envío de una marcación.
sealed class ResultadoEnvio {}

class EnvioConfirmado extends ResultadoEnvio {
  EnvioConfirmado(this.confirmacion);
  final Confirmacion confirmacion;
}

/// RN-07: el servidor detectó un posible duplicado y requiere confirmación del conductor.
class EnvioPosibleDuplicado extends ResultadoEnvio {
  EnvioPosibleDuplicado(this.mensaje);
  final String mensaje;
}

/// Error definitivo (403: conductor no registrado o dispositivo revocado; 400: datos inválidos).
class EnvioRechazado extends ResultadoEnvio {
  EnvioRechazado(this.estado, this.mensaje);
  final int estado;
  final String mensaje;
}

/// Error transitorio (sin red, 5xx, tiempo agotado): la marcación queda en la cola.
class EnvioReintentable extends ResultadoEnvio {}

abstract class ApiMarcaciones {
  Future<ResultadoEnvio> enviar(MarcacionPendiente m);
}

class ApiCliente implements ApiMarcaciones {
  ApiCliente(
      {required this.baseUrl,
      required this.token,
      required this.appVersion,
      http.Client? cliente})
      : _http = cliente ?? http.Client();

  final String baseUrl;
  final Future<String> Function() token;
  final String appVersion;
  final http.Client _http;

  @override
  Future<ResultadoEnvio> enviar(MarcacionPendiente m) async {
    try {
      final r = await _http
          .post(
            Uri.parse('$baseUrl/marcaciones'),
            headers: {
              'content-type': 'application/json',
              'authorization': 'Bearer ${await token()}',
            },
            body: jsonEncode(m.aJson(appVersion)),
          )
          .timeout(const Duration(seconds: 10));
      final cuerpo = r.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(r.body) as Map<String, dynamic>;
      if (r.statusCode == 200 || r.statusCode == 201) {
        return EnvioConfirmado(Confirmacion.desdeJson(cuerpo));
      }
      if (r.statusCode == 409 && cuerpo['codigo'] == 'POSIBLE_DUPLICADO') {
        return EnvioPosibleDuplicado(
            cuerpo['mensaje'] as String? ?? 'Posible marcación duplicada.');
      }
      if (r.statusCode >= 500 || r.statusCode == 429 || r.statusCode == 401)
        return EnvioReintentable();
      final msg = cuerpo['message'];
      return EnvioRechazado(r.statusCode,
          msg is List ? msg.join('; ') : '${msg ?? 'Error ${r.statusCode}'}');
    } on SocketException {
      return EnvioReintentable();
    } on TimeoutException {
      return EnvioReintentable();
    } on http.ClientException {
      return EnvioReintentable();
    }
  }

  Future<List<Confirmacion>> historialDelDia() async {
    final r = await _http.get(
      Uri.parse('$baseUrl/marcaciones/hoy'),
      headers: {'authorization': 'Bearer ${await token()}'},
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body) as List<dynamic>)
        .map((e) => Confirmacion.desdeJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> enrolarDispositivo(
      String idinst, String modelo, String so) async {
    final r = await _http.post(
      Uri.parse('$baseUrl/auth/dispositivos'),
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ${await token()}'
      },
      body: jsonEncode({'idinst': idinst, 'modelo': modelo, 'so': so}),
    );
    if (r.statusCode != 201 && r.statusCode != 200) {
      throw EnrolamientoRechazado(
          'Número no registrado. Contacte al Administrador.');
    }
    return jsonDecode(r.body) as Map<String, dynamic>;
  }
}

class EnrolamientoRechazado implements Exception {
  EnrolamientoRechazado(this.mensaje);
  final String mensaje;
  @override
  String toString() => mensaje;
}

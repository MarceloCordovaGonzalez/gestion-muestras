import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import '../datos/api_cliente.dart';
import 'autenticacion.dart';

/// Almacenamiento clave-valor (permite pruebas sin plugins nativos).
abstract class AlmacenClaveValor {
  Future<String?> leer(String clave);
  Future<void> escribir(String clave, String valor);
  Future<void> borrar(String clave);
}

class AlmacenSeguro implements AlmacenClaveValor {
  const AlmacenSeguro();
  static const _s = FlutterSecureStorage();

  @override
  Future<String?> leer(String clave) => _s.read(key: clave);

  @override
  Future<void> escribir(String clave, String valor) =>
      _s.write(key: clave, value: valor);

  @override
  Future<void> borrar(String clave) => _s.delete(key: clave);
}

class AlmacenEnMemoria implements AlmacenClaveValor {
  final Map<String, String> _m = {};

  @override
  Future<String?> leer(String clave) async => _m[clave];

  @override
  Future<void> escribir(String clave, String valor) async {
    _m[clave] = valor;
  }

  @override
  Future<void> borrar(String clave) async {
    _m.remove(clave);
  }
}

/// Autenticación SOLO PARA EL AMBIENTE DE DESARROLLO (AMBIENTE=dev).
///
/// Simula el CU-01 sin Firebase: el conductor ingresa su celular registrado en la lista
/// Conductor, el código de prueba [codigoPrueba] y el dispositivo se enrola en la API, que
/// debe ejecutarse con AUTH_DEV_BYPASS=true (nunca disponible en producción).
/// Los tokens tienen el formato `dev:<PERFIL>:<CODEMP>:<rutcon>:<iddis>:<telefono>`.
class AutenticacionDesarrollo implements Autenticacion {
  AutenticacionDesarrollo._(this._almacen, this._codemp);

  static const codigoPrueba = '123456';
  static const _kSesion = 'gm_dev_sesion';
  static const _kIdinst = 'gm_idinst';

  final AlmacenClaveValor _almacen;
  final String _codemp;
  String? _telefono;
  String? _tokenSesion;

  /// Crea la instancia y recupera la sesión guardada, si existe.
  static Future<AutenticacionDesarrollo> crear({
    AlmacenClaveValor almacen = const AlmacenSeguro(),
    String codemp = 'EMP1',
  }) async {
    final a = AutenticacionDesarrollo._(almacen, codemp);
    a._tokenSesion = await almacen.leer(_kSesion);
    return a;
  }

  @override
  bool get haySesion => _tokenSesion != null;

  @override
  Future<String> token({bool renovar = false}) async {
    final t = _tokenSesion;
    if (t != null) return t;
    final tel = _telefono;
    if (tel == null) throw StateError('Sin sesión');
    return 'dev:CONDUCTOR:$_codemp:::$tel'; // previo al enrolamiento
  }

  @override
  Future<void> solicitarCodigo(String celularE164) async {
    _telefono = celularE164.replaceAll(' ', '');
  }

  @override
  Future<void> validarCodigo(String codigo) async {
    if (codigo != codigoPrueba) {
      throw StateError('Código incorrecto (desarrollo: $codigoPrueba).');
    }
  }

  @override
  Future<void> enrolar(ApiCliente api) async {
    var idinst = await _almacen.leer(_kIdinst);
    if (idinst == null) {
      idinst = const Uuid().v4();
      await _almacen.escribir(_kIdinst, idinst);
    }
    final r = await api.enrolarDispositivo(
      idinst,
      Platform.operatingSystemVersion,
      Platform.operatingSystem,
    );
    _tokenSesion = tokenDeEnrolamiento(r, _codemp, _telefono ?? '');
    await _almacen.escribir(_kSesion, _tokenSesion!);
  }

  @override
  Future<void> cerrarSesion() async {
    _tokenSesion = null;
    _telefono = null;
    await _almacen.borrar(_kSesion);
  }

  /// Token de sesión a partir de la respuesta de POST /v1/auth/dispositivos.
  static String tokenDeEnrolamiento(
      Map<String, dynamic> r, String codemp, String telefono) {
    final perfil = r['perfil'] as String? ?? 'CONDUCTOR';
    return 'dev:$perfil:$codemp:${r['rutcon']}:${r['iddis']}:$telefono';
  }
}

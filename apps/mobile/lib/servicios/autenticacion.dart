import 'dart:async';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import '../datos/api_cliente.dart';

/// CU-01: OTP por SMS (Identity Platform) y enrolamiento del dispositivo.
/// La sesión se renueva automáticamente (refresh token de Identity Platform).
class ServicioAutenticacion {
  ServicioAutenticacion({FirebaseAuth? auth})
      : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;
  static const _almacen = FlutterSecureStorage();
  String? _verificationId;

  bool get haySesion => _auth.currentUser != null;

  /// Token vigente para la API. `renovar` fuerza la lectura de claims nuevos tras enrolar.
  Future<String> token({bool renovar = false}) async {
    final u = _auth.currentUser;
    if (u == null) throw StateError('Sin sesión');
    return (await u.getIdToken(renovar))!;
  }

  /// Paso 4: el Sistema envía el OTP (válido por 5 minutos) al número en formato E.164.
  Future<void> solicitarCodigo(String celularE164) {
    final listo = Completer<void>();
    _auth.verifyPhoneNumber(
      phoneNumber: celularE164,
      timeout: const Duration(minutes: 2),
      verificationCompleted: (cred) async {
        await _auth.signInWithCredential(cred); // autoverificación en Android
        if (!listo.isCompleted) listo.complete();
      },
      verificationFailed: (e) {
        if (!listo.isCompleted) listo.completeError(e);
      },
      codeSent: (id, _) {
        _verificationId = id;
        if (!listo.isCompleted) listo.complete();
      },
      codeAutoRetrievalTimeout: (id) => _verificationId = id,
    );
    return listo.future;
  }

  /// Paso 5: validar el código. Los intentos y bloqueos los aplica Identity Platform (5a).
  Future<void> validarCodigo(String codigo) async {
    final id = _verificationId;
    if (id == null) throw StateError('Solicite primero el código.');
    await _auth.signInWithCredential(
        PhoneAuthProvider.credential(verificationId: id, smsCode: codigo));
  }

  /// Paso 6: enrolar el dispositivo. El identificador de instalación se genera una sola vez.
  Future<void> enrolar(ApiCliente api) async {
    var idinst = await _almacen.read(key: 'gm_idinst');
    if (idinst == null) {
      idinst = const Uuid().v4();
      await _almacen.write(key: 'gm_idinst', value: idinst);
    }
    await api.enrolarDispositivo(
        idinst, Platform.operatingSystemVersion, Platform.operatingSystem);
    await token(renovar: true);
  }

  Future<void> cerrarSesion() => _auth.signOut();
}

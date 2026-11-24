import 'package:flutter_test/flutter_test.dart';
import 'package:gestion_muestras/servicios/autenticacion_desarrollo.dart';

void main() {
  test('CU-01 (dev): token previo al enrolamiento lleva el teléfono', () async {
    final a = await AutenticacionDesarrollo.crear(almacen: AlmacenEnMemoria());
    expect(a.haySesion, isFalse);
    await a.solicitarCodigo('+56 9 1234 0001');
    expect(await a.token(), 'dev:CONDUCTOR:EMP1:::+56912340001');
  });

  test('CU-01 (dev): solo acepta el código de prueba', () async {
    final a = await AutenticacionDesarrollo.crear(almacen: AlmacenEnMemoria());
    await a.validarCodigo(AutenticacionDesarrollo.codigoPrueba);
    expect(() => a.validarCodigo('000000'), throwsStateError);
  });

  test('token de sesión tras enrolar contiene rutcon e iddis', () {
    final t = AutenticacionDesarrollo.tokenDeEnrolamiento(
      {'rutcon': 12345678, 'iddis': 'abc', 'perfil': 'CONDUCTOR'},
      'EMP1',
      '+56912340001',
    );
    expect(t, 'dev:CONDUCTOR:EMP1:12345678:abc:+56912340001');
  });

  test('la sesión guardada se recupera al reabrir la App', () async {
    final almacen = AlmacenEnMemoria();
    await almacen.escribir('gm_dev_sesion', 'dev:CONDUCTOR:EMP1:1:x:');
    final a = await AutenticacionDesarrollo.crear(almacen: almacen);
    expect(a.haySesion, isTrue);
    await a.cerrarSesion();
    expect(a.haySesion, isFalse);
  });
}

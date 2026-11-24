import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_core/firebase_core.dart';
// TODO(MVP1): migrar a package:material_ui (Flutter 3.47+ depreca material.dart).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'config.dart';
import 'datos/api_cliente.dart';
import 'datos/cola_local.dart';
import 'servicios/autenticacion.dart';
import 'servicios/sincronizacion.dart';
import 'servicios/ubicacion.dart';
import 'ui/pantalla_inicio.dart';
import 'ui/pantalla_ingreso.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase
      .initializeApp(); // google-services.json / GoogleService-Info.plist por ambiente

  final auth = ServicioAutenticacion();
  final api = ApiCliente(
      baseUrl: Config.apiUrl, token: auth.token, appVersion: Config.appVersion);
  final marcacion =
      ServicioMarcacion(cola: await ColaSqlCipher.abrir(), api: api);

  // Sincroniza la cola al recuperar conectividad (RF-08).
  Connectivity().onConnectivityChanged.listen((estados) {
    if (estados.any((e) => e != ConnectivityResult.none)) {
      unawaited(marcacion.sincronizar());
    }
  });

  runApp(AppConductor(
      auth: auth,
      api: api,
      marcacion: marcacion,
      ubicacion: ServicioUbicacion()));
}

class AppConductor extends StatefulWidget {
  const AppConductor({
    super.key,
    required this.auth,
    required this.api,
    required this.marcacion,
    required this.ubicacion,
  });

  final ServicioAutenticacion auth;
  final ApiCliente api;
  final ServicioMarcacion marcacion;
  final ServicioUbicacion ubicacion;

  @override
  State<AppConductor> createState() => _AppConductorState();
}

class _AppConductorState extends State<AppConductor> {
  late bool _enrolado = widget.auth.haySesion;

  @override
  Widget build(BuildContext context) {
    // Accesibilidad (Especificación 8.1): alto contraste y texto mínimo de 16 sp.
    final tema = ThemeData(
      colorSchemeSeed: const Color(0xFF1F5FD1),
      useMaterial3: true,
      textTheme: const TextTheme(
          bodyMedium: TextStyle(fontSize: 16),
          bodyLarge: TextStyle(fontSize: 18)),
    );
    return MaterialApp(
      title: 'Gestión de Muestras',
      theme: tema,
      home: _enrolado
          ? PantallaInicio(
              api: widget.api,
              marcacion: widget.marcacion,
              ubicacion: widget.ubicacion)
          : PantallaIngreso(
              auth: widget.auth,
              api: widget.api,
              alEnrolar: () => setState(() => _enrolado = true)),
    );
  }
}

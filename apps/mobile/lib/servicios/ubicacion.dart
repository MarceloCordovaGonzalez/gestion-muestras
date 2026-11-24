import 'package:geolocator/geolocator.dart';

class LecturaUbicacion {
  LecturaUbicacion(this.lat, this.lon, this.precision);
  final double lat;
  final double lon;

  /// Metros. En MVP1 solo se registra (RF-09); la validación con umbral es MVP3.
  final int precision;
}

class PermisoUbicacionDenegado implements Exception {
  PermisoUbicacionDenegado(this.permanente);
  final bool permanente;
}

/// Lectura de alta precisión solo al marcar: sin seguimiento continuo (RNF-05).
class ServicioUbicacion {
  Future<LecturaUbicacion> leer() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw PermisoUbicacionDenegado(false);
    }
    var permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied)
      permiso = await Geolocator.requestPermission();
    if (permiso == LocationPermission.denied)
      throw PermisoUbicacionDenegado(false);
    if (permiso == LocationPermission.deniedForever)
      throw PermisoUbicacionDenegado(true);

    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.best,
        timeLimit: Duration(seconds: 15),
      ),
    );
    // MVP3 (RF-09): validar pos.accuracy contra el umbral, reintentar y revisar pos.isMocked.
    return LecturaUbicacion(pos.latitude, pos.longitude, pos.accuracy.round());
  }

  Future<bool> abrirConfiguracion() => Geolocator.openAppSettings();
}

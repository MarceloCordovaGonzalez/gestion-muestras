/// Modelos de la marcación (CU-02) alineados con packages/contracts/openapi.yaml.
library;

enum OrigenMarcacion { enLinea, sinConexion }

extension OrigenApi on OrigenMarcacion {
  String get api =>
      this == OrigenMarcacion.enLinea ? 'EN_LINEA' : 'SIN_CONEXION';
}

/// Marcación capturada en el dispositivo. Se persiste en la cola local ANTES de enviarse
/// (Modelo de Arquitectura 7.1); `idvia` es el UUID que garantiza la idempotencia (RF-08).
class MarcacionPendiente {
  MarcacionPendiente({
    required this.idvia,
    required this.datevia,
    required this.lat,
    required this.lon,
    required this.precision,
    required this.origen,
    this.confirmarDuplicado = false,
    this.intentos = 0,
  });

  final String idvia;

  /// Hora del dispositivo al marcar (RN-06); se conserva al sincronizar.
  final DateTime datevia;
  final double lat;
  final double lon;

  /// Precisión GPS en metros: solo se registra en MVP1 (RF-09).
  final int precision;
  final OrigenMarcacion origen;
  final bool confirmarDuplicado;
  final int intentos;

  MarcacionPendiente copiar(
          {OrigenMarcacion? origen, bool? confirmarDuplicado, int? intentos}) =>
      MarcacionPendiente(
        idvia: idvia,
        datevia: datevia,
        lat: lat,
        lon: lon,
        precision: precision,
        origen: origen ?? this.origen,
        confirmarDuplicado: confirmarDuplicado ?? this.confirmarDuplicado,
        intentos: intentos ?? this.intentos,
      );

  Map<String, Object?> aJson(String appVersion) => {
        'idvia': idvia,
        'datevia': _iso8601ConZona(datevia),
        'lat': lat,
        'lon': lon,
        'precision': precision,
        'origen': origen.api,
        'appVersion': appVersion,
        if (confirmarDuplicado) 'confirmarDuplicado': true,
      };

  Map<String, Object?> aFila() => {
        'idvia': idvia,
        'datevia': datevia.toUtc().toIso8601String(),
        'lat': lat,
        'lon': lon,
        'precision': precision,
        'origen': origen.api,
        'confirmar_duplicado': confirmarDuplicado ? 1 : 0,
        'intentos': intentos,
      };

  static MarcacionPendiente desdeFila(Map<String, Object?> f) =>
      MarcacionPendiente(
        idvia: f['idvia']! as String,
        datevia: DateTime.parse(f['datevia']! as String),
        lat: (f['lat']! as num).toDouble(),
        lon: (f['lon']! as num).toDouble(),
        precision: (f['precision']! as num).toInt(),
        origen: f['origen'] == 'EN_LINEA'
            ? OrigenMarcacion.enLinea
            : OrigenMarcacion.sinConexion,
        confirmarDuplicado: f['confirmar_duplicado'] == 1,
        intentos: (f['intentos'] as num?)?.toInt() ?? 0,
      );
}

/// Confirmación al conductor (RF-06): fecha, hora, punto, comuna, tipo y estado.
class Confirmacion {
  Confirmacion({
    required this.idvia,
    required this.fecha,
    required this.hora,
    required this.tipvia,
    required this.estvia,
    required this.comuna,
    required this.fueraDeRuta,
    this.puntoAlias,
    this.distancia,
  });

  final String idvia;
  final String fecha;
  final String hora;
  final String? tipvia;
  final String estvia;
  final String comuna;
  final bool fueraDeRuta;
  final String? puntoAlias;
  final int? distancia;

  bool get correcta => estvia == 'CORRECTO';
  String get tipoTexto =>
      tipvia == 'R' ? 'Retiro' : (tipvia == 'E' ? 'Entrega' : 'Sin punto');

  factory Confirmacion.desdeJson(Map<String, dynamic> j) => Confirmacion(
        idvia: j['idvia'] as String,
        fecha: j['fecha'] as String,
        hora: j['hora'] as String,
        tipvia: j['tipvia'] as String?,
        estvia: j['estvia'] as String,
        comuna: j['comuna'] as String,
        fueraDeRuta: j['fueraDeRuta'] as bool? ?? false,
        puntoAlias: (j['punto'] as Map<String, dynamic>?)?['alias'] as String?,
        distancia: (j['distancia'] as num?)?.toInt(),
      );
}

/// ISO 8601 con desplazamiento local (p. ej. 2026-09-30T12:02:25-03:00).
String _iso8601ConZona(DateTime d) {
  final local = d.toLocal();
  final off = local.timeZoneOffset;
  final signo = off.isNegative ? '-' : '+';
  String dos(int n) => n.abs().toString().padLeft(2, '0');
  final base = local.toIso8601String().split('.').first;
  return '$base$signo${dos(off.inHours)}:${dos(off.inMinutes.remainder(60))}';
}

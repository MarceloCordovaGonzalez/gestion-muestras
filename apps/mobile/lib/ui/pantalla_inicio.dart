import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../datos/api_cliente.dart';
import '../dominio/marcacion.dart';
import '../servicios/sincronizacion.dart';
import '../servicios/ubicacion.dart';

const _azul = Color(0xFF1F5FD1);
const _magenta = Color(0xFFC2187A);
const _naranja = Color(0xFFE67E22);
const _rojo = Color(0xFFC0392B);

/// Pantalla principal (Especificación 8.1): botón «Marcar ahora», estado de la cola e historial.
/// RNF-07: una marcación se completa en ≤ 2 toques. Se recomienda marcar con el vehículo detenido.
class PantallaInicio extends StatefulWidget {
  const PantallaInicio({super.key, required this.api, required this.marcacion, required this.ubicacion});

  final ApiCliente api;
  final ServicioMarcacion marcacion;
  final ServicioUbicacion ubicacion;

  @override
  State<PantallaInicio> createState() => _PantallaInicioState();
}

class _PantallaInicioState extends State<PantallaInicio> {
  bool _marcando = false;
  int _pendientes = 0;
  List<Confirmacion> _historial = [];
  StreamSubscription<Confirmacion>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = widget.marcacion.confirmaciones.listen((_) => _refrescar());
    unawaited(widget.marcacion.sincronizar().then((_) => _refrescar()));
  }

  @override
  void dispose() {
    unawaited(_sub?.cancel());
    super.dispose();
  }

  Future<void> _refrescar() async {
    final pendientes = await widget.marcacion.cola.cantidad();
    final historial = await widget.api.historialDelDia();
    if (mounted) setState(() {
      _pendientes = pendientes;
      _historial = historial.reversed.toList();
    });
  }

  Future<void> _marcar() async {
    setState(() => _marcando = true);
    try {
      final l = await widget.ubicacion.leer();
      final r = await widget.marcacion.marcar(lat: l.lat, lon: l.lon, precision: l.precision);
      await _mostrarResultado(r);
    } on PermisoUbicacionDenegado catch (e) {
      // Flujo 7a del CU-01: sin permiso de ubicación no es posible marcar.
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Ubicación requerida'),
          content: const Text('Para marcar debe activar la ubicación y conceder el permiso a la App.'),
          actions: [
            if (e.permanente)
              TextButton(onPressed: () => widget.ubicacion.abrirConfiguracion(), child: const Text('Abrir configuración')),
            TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cerrar')),
          ],
        ),
      );
    } finally {
      if (mounted) setState(() => _marcando = false);
      await _refrescar();
    }
  }

  Future<void> _mostrarResultado(ResultadoMarcacion r) async {
    if (!mounted) return;
    switch (r) {
      case MarcacionConfirmada(:final confirmacion):
        await HapticFeedback.heavyImpact();
        if (!mounted) return;
        await Navigator.push(context, MaterialPageRoute<void>(builder: (_) => PantallaConfirmacion(c: confirmacion)));
      case MarcacionPendienteDeEnvio():
        _aviso('Marcación pendiente de envío. Se enviará al recuperar la conexión.');
      case MarcacionRequiereConfirmacion(:final idvia, :final mensaje):
        final si = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Posible marcación duplicada'),
            content: Text(mensaje),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('No registrar')),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Registrar de todos modos')),
            ],
          ),
        );
        if (si ?? false) {
          await _mostrarResultado(await widget.marcacion.confirmarDuplicado(idvia));
        } else {
          await widget.marcacion.descartar(idvia);
        }
      case MarcacionRechazada(:final mensaje):
        _aviso(mensaje, error: true);
    }
  }

  void _aviso(String texto, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(texto), backgroundColor: error ? _rojo : null),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gestión de Muestras')),
      body: RefreshIndicator(
        onRefresh: () async {
          await widget.marcacion.sincronizar();
          await _refrescar();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_pendientes > 0)
              Card(
                color: const Color(0xFFFFF4E5),
                child: ListTile(
                  leading: const Icon(Icons.cloud_off, color: _naranja),
                  title: Text('$_pendientes marcación(es) pendiente(s) de envío'),
                ),
              ),
            const SizedBox(height: 8),
            SizedBox(
              height: 140,
              child: FilledButton.icon(
                onPressed: _marcando ? null : _marcar,
                icon: _marcando
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Icon(Icons.place, size: 40),
                label: Text(_marcando ? 'Obteniendo ubicación…' : 'MARCAR AHORA',
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 24),
            Text('Historial del día', style: Theme.of(context).textTheme.titleLarge),
            if (_historial.isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('Sin marcaciones hoy.')),
            ..._historial.map(_filaHistorial),
          ],
        ),
      ),
    );
  }

  Widget _filaHistorial(Confirmacion c) => ListTile(
        leading: Icon(
          c.correcta ? Icons.check_circle : Icons.error,
          color: !c.correcta ? _rojo : (c.fueraDeRuta ? _naranja : (c.tipvia == 'R' ? _azul : _magenta)),
        ),
        title: Text('${c.hora} · ${c.tipoTexto} · ${c.puntoAlias ?? 'Error'}'),
        subtitle: Text('${c.comuna}${c.fueraDeRuta ? ' · fuera de ruta' : ''}'),
      );
}

/// Confirmación (RF-06, paso 10 del CU-02).
class PantallaConfirmacion extends StatelessWidget {
  const PantallaConfirmacion({super.key, required this.c});
  final Confirmacion c;

  @override
  Widget build(BuildContext context) {
    final color = !c.correcta ? _rojo : (c.fueraDeRuta ? _naranja : (c.tipvia == 'R' ? _azul : _magenta));
    Widget fila(String k, String v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            SizedBox(width: 130, child: Text(k, style: const TextStyle(color: Colors.black54))),
            Expanded(child: Text(v, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600))),
          ]),
        );
    return Scaffold(
      appBar: AppBar(title: const Text('Confirmación'), backgroundColor: color, foregroundColor: Colors.white),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Icon(c.correcta ? Icons.check_circle : Icons.error, size: 72, color: color),
          Text(c.correcta ? 'Correcto' : 'Error', textAlign: TextAlign.center,
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 16),
          fila('Fecha', c.fecha),
          fila('Hora', c.hora),
          fila('Tipo', c.tipoTexto),
          fila(c.tipvia == 'E' ? 'Laboratorio' : 'Centro', c.puntoAlias ?? '—'),
          fila('Comuna', c.comuna),
          if (c.distancia != null) fila('Distancia', '${c.distancia} m'),
          if (c.fueraDeRuta)
            const Card(
              color: Color(0xFFFFF4E5),
              child: ListTile(
                leading: Icon(Icons.warning_amber, color: _naranja),
                title: Text('Retiro fuera de ruta'),
                subtitle: Text('El centro no está en su planificación de hoy. Se informó al Administrador.'),
              ),
            ),
          if (!c.correcta)
            const Text('La ubicación no coincide con ningún centro ni laboratorio registrado.'),
          const Spacer(),
          FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Volver')),
        ]),
      ),
    );
  }
}

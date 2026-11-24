import 'package:flutter/material.dart';

import '../datos/api_cliente.dart';
import '../servicios/autenticacion.dart';

/// CU-01: ingreso con número de celular y código OTP.
class PantallaIngreso extends StatefulWidget {
  const PantallaIngreso({super.key, required this.auth, required this.api, required this.alEnrolar});

  final ServicioAutenticacion auth;
  final ApiCliente api;
  final VoidCallback alEnrolar;

  @override
  State<PantallaIngreso> createState() => _PantallaIngresoState();
}

class _PantallaIngresoState extends State<PantallaIngreso> {
  final _celular = TextEditingController(text: '+569');
  final _codigo = TextEditingController();
  bool _codigoEnviado = false;
  bool _ocupado = false;
  String? _error;

  Future<void> _ejecutar(Future<void> Function() accion) async {
    setState(() {
      _ocupado = true;
      _error = null;
    });
    try {
      await accion();
    } on EnrolamientoRechazado catch (e) {
      _error = e.mensaje; // flujo 3a: número no registrado
      await widget.auth.cerrarSesion();
      _codigoEnviado = false;
    } catch (_) {
      _error = _codigoEnviado ? 'Código incorrecto o vencido.' : 'No fue posible enviar el código.';
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ingreso del conductor')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _celular,
              enabled: !_codigoEnviado,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Número de celular (+569XXXXXXXX)'),
            ),
            if (_codigoEnviado)
              TextField(
                controller: _codigo,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: const InputDecoration(labelText: 'Código recibido por SMS'),
              ),
            const SizedBox(height: 16),
            if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _ocupado
                  ? null
                  : () => _ejecutar(() async {
                        if (!_codigoEnviado) {
                          await widget.auth.solicitarCodigo(_celular.text.replaceAll(' ', ''));
                          setState(() => _codigoEnviado = true);
                          if (!widget.auth.haySesion) return;
                        } else {
                          await widget.auth.validarCodigo(_codigo.text.trim());
                        }
                        await widget.auth.enrolar(widget.api);
                        widget.alEnrolar();
                      }),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(_codigoEnviado ? 'Validar código' : 'Enviar código'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

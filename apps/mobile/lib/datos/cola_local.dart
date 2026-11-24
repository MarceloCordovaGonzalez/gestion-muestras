import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_sqlcipher/sqflite.dart';

import '../dominio/marcacion.dart';

/// Cola local persistente de marcaciones (RF-08). Implementación cifrada con SQLCipher
/// (Modelo de Arquitectura 11.1); la clave se guarda en el almacenamiento seguro del SO.
abstract class ColaLocal {
  Future<void> encolar(MarcacionPendiente m);
  Future<List<MarcacionPendiente>> pendientes();
  Future<void> actualizar(MarcacionPendiente m);
  Future<void> eliminar(String idvia);
  Future<int> cantidad();
}

class ColaSqlCipher implements ColaLocal {
  ColaSqlCipher._(this._db);
  final Database _db;

  static Future<ColaSqlCipher> abrir() async {
    const almacen = FlutterSecureStorage();
    var clave = await almacen.read(key: 'gm_db_key');
    if (clave == null) {
      final r = Random.secure();
      clave = base64UrlEncode(List<int>.generate(32, (_) => r.nextInt(256)));
      await almacen.write(key: 'gm_db_key', value: clave);
    }
    final ruta = p.join(await getDatabasesPath(), 'gm_cola.db');
    final db = await openDatabase(
      ruta,
      password: clave,
      version: 1,
      onCreate: (db, _) => db.execute('''
        CREATE TABLE cola (
          idvia TEXT PRIMARY KEY,
          datevia TEXT NOT NULL,
          lat REAL NOT NULL,
          lon REAL NOT NULL,
          precision INTEGER NOT NULL,
          origen TEXT NOT NULL,
          confirmar_duplicado INTEGER NOT NULL DEFAULT 0,
          intentos INTEGER NOT NULL DEFAULT 0
        )'''),
    );
    return ColaSqlCipher._(db);
  }

  @override
  Future<void> encolar(MarcacionPendiente m) async {
    await _db.insert('cola', m.aFila(), conflictAlgorithm: ConflictAlgorithm.ignore);
  }

  @override
  Future<List<MarcacionPendiente>> pendientes() async =>
      (await _db.query('cola', orderBy: 'datevia')).map(MarcacionPendiente.desdeFila).toList();

  @override
  Future<void> actualizar(MarcacionPendiente m) async {
    await _db.update('cola', m.aFila(), where: 'idvia = ?', whereArgs: [m.idvia]);
  }

  @override
  Future<void> eliminar(String idvia) async {
    await _db.delete('cola', where: 'idvia = ?', whereArgs: [idvia]);
  }

  @override
  Future<int> cantidad() async =>
      Sqflite.firstIntValue(await _db.rawQuery('SELECT count(*) FROM cola')) ?? 0;
}

/// Implementación en memoria (pruebas).
class ColaEnMemoria implements ColaLocal {
  final Map<String, MarcacionPendiente> _items = {};

  @override
  Future<void> encolar(MarcacionPendiente m) async {
    _items.putIfAbsent(m.idvia, () => m);
  }

  @override
  Future<List<MarcacionPendiente>> pendientes() async =>
      _items.values.toList()..sort((a, b) => a.datevia.compareTo(b.datevia));

  @override
  Future<void> actualizar(MarcacionPendiente m) async {
    _items[m.idvia] = m;
  }

  @override
  Future<void> eliminar(String idvia) async {
    _items.remove(idvia);
  }

  @override
  Future<int> cantidad() async => _items.length;
}

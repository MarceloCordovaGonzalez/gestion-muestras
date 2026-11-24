/** Procesa marcaciones crudas con las reglas del dominio, igual que la API (CU-02, pasos 4 a 8). */
import { evaluarFueraDeRuta } from '../../src/fuera-ruta.ts';
import { clasificarMarcacion } from '../../src/geovalidacion.ts';
import { fechaLocal } from '../../src/tiempo.ts';
import type { Viaje } from '../../src/tipos.ts';
import {
  CENTROS,
  COMUNA_OFICIAL_PUNTO_ERROR,
  LABORATORIOS,
  MARCACIONES,
  RUTAS,
} from './escenario-30-09-2026.ts';

export function procesarEscenario(): Viaje[] {
  return MARCACIONES.map((m, i) => {
    const g = clasificarMarcacion(m, CENTROS, LABORATORIOS, COMUNA_OFICIAL_PUNTO_ERROR);
    const fueraruta = evaluarFueraDeRuta(
      { ...g, rutcon: m.rutcon, fecha: fechaLocal(m.datevia) },
      RUTAS.filter((r) => r.rutcon === m.rutcon),
      CENTROS,
    );
    return {
      idvia: `via-${i + 1}`,
      rutcon: m.rutcon,
      datevia: m.datevia,
      tipvia: g.tipvia,
      estvia: g.estvia,
      codcen: g.codcen,
      codlab: g.codlab,
      comuna: g.comuna,
      fueraruta,
    };
  });
}

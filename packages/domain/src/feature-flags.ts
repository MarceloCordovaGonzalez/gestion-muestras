/**
 * Indicadores de funcionalidad del Piloto 1 (decisión del cliente del 12/11/2026):
 *
 * - `deduplicacion` (MEJ-07 / RN-07): programada y ACTIVA.
 * - `pendientesEntrega` (MEJ-18 / RN-16): programada y DESACTIVADA en MVP1; por confirmar en MVP2.
 *
 * Prioridad: parámetro por empresa (tabla PARAMETRO) > variable de entorno > valor por defecto.
 */
export interface IndicadoresFuncionalidad {
  deduplicacion: boolean;
  pendientesEntrega: boolean;
}

export const INDICADORES_POR_DEFECTO: Readonly<IndicadoresFuncionalidad> = Object.freeze({
  deduplicacion: true,
  pendientesEntrega: false,
});

const aBooleano = (v: string | undefined): boolean | undefined =>
  v === undefined ? undefined : ['1', 'true', 'si', 'sí', 's'].includes(v.trim().toLowerCase());

export function resolverIndicadores(
  entorno: Record<string, string | undefined> = {},
  porEmpresa: Partial<IndicadoresFuncionalidad> = {},
): IndicadoresFuncionalidad {
  return {
    deduplicacion:
      porEmpresa.deduplicacion ??
      aBooleano(entorno['FEATURE_DEDUPLICACION']) ??
      INDICADORES_POR_DEFECTO.deduplicacion,
    pendientesEntrega:
      porEmpresa.pendientesEntrega ??
      aBooleano(entorno['FEATURE_PENDIENTES_ENTREGA']) ??
      INDICADORES_POR_DEFECTO.pendientesEntrega,
  };
}

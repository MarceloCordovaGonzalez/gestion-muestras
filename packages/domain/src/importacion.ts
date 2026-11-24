/**
 * Reglas de la importación de metadatos (CU-05, RF-16 aceptado con reparo del 10/11/2026).
 * Se importan CENTRO, LABORATORIO, CONDUCTOR y RUTA CONDUCTOR. La hoja VIAJE se ignora: la lista
 * Viaje se inicializa vacía en producción.
 */

export const HOJAS_IMPORTABLES = ['CENTRO', 'LABORATORIO', 'CONDUCTOR', 'RUTA CONDUCTOR'] as const;
export type HojaImportable = (typeof HOJAS_IMPORTABLES)[number];
export const HOJAS_IGNORADAS = ['VIAJE'] as const;

export const ENCABEZADOS_OBLIGATORIOS: Record<HojaImportable, readonly string[]> = {
  CENTRO: [
    'CODEMP',
    'CODCEN',
    'COMCEN',
    'DESCEN',
    'ALICEN',
    'LATCEN',
    'LONCEN',
    'RADCEN',
    'LUN',
    'MAR',
    'MIE',
    'JUE',
    'VIE',
    'SAB',
    'DOM',
    'CODLAB',
  ],
  LABORATORIO: ['CODEMP', 'CODLAB', 'COMLAB', 'DESLAB', 'ALILAB', 'LATLAB', 'LONLAB', 'RADLAB'],
  CONDUCTOR: ['CODEMP', 'RUTCON', 'DVECON', 'NOMCON', 'PRIAPECON', 'CELCON'],
  'RUTA CONDUCTOR': ['CODEMP', 'RUTCON', 'HORRUT', 'CODCEN', 'ESTRUT'],
};

/** Normalización de encabezados (HAL-10): DATCRE → DATECRE, «USRACT 2» → DATEACT, etc. */
const ALIAS_ENCABEZADOS: Record<string, string> = {
  DATCRE: 'DATECRE',
  'USRACT 2': 'DATEACT',
  EMPRESA: 'CODEMP',
};

export function normalizarEncabezado(encabezado: unknown): string {
  const limpio = String(encabezado ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return ALIAS_ENCABEZADOS[limpio] ?? limpio;
}

export interface ResultadoClasificacionHojas {
  importables: HojaImportable[];
  ignoradas: string[];
  desconocidas: string[];
}

export function clasificarHojas(nombres: readonly string[]): ResultadoClasificacionHojas {
  const r: ResultadoClasificacionHojas = { importables: [], ignoradas: [], desconocidas: [] };
  for (const n of nombres) {
    const k = n.trim().toUpperCase();
    if ((HOJAS_IMPORTABLES as readonly string[]).includes(k))
      r.importables.push(k as HojaImportable);
    else if ((HOJAS_IGNORADAS as readonly string[]).includes(k)) r.ignoradas.push(k);
    else r.desconocidas.push(n);
  }
  return r;
}

export interface ErrorEncabezado {
  hoja: HojaImportable;
  columna: number | null;
  mensaje: string;
}

/**
 * HAL-18: valida presencia y nombre de los encabezados obligatorios antes de cargar.
 * Un encabezado vacío en una columna con datos (p. ej. CODEMP en A1 de CENTRO) se reporta.
 */
export function validarEncabezados(
  hoja: HojaImportable,
  encabezados: readonly unknown[],
): ErrorEncabezado[] {
  const errores: ErrorEncabezado[] = [];
  const normalizados = encabezados.map(normalizarEncabezado);
  normalizados.forEach((h, i) => {
    if (h === '') {
      errores.push({ hoja, columna: i + 1, mensaje: `Encabezado vacío en la columna ${i + 1}.` });
    }
  });
  for (const requerido of ENCABEZADOS_OBLIGATORIOS[hoja]) {
    if (!normalizados.includes(requerido)) {
      errores.push({
        hoja,
        columna: null,
        mensaje: `Falta el encabezado obligatorio ${requerido}.`,
      });
    }
  }
  return errores;
}

/** HORRUT numérica HHMMSS (110000) → «11:00:00». También acepta «11:00» y fracciones de Excel. */
export function normalizarHora(valor: unknown): string | null {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  if (typeof valor === 'number' && valor > 0 && valor < 1) {
    const totalSeg = Math.round(valor * 86_400);
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
  }
  const texto = String(valor).trim();
  const conSeparador = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(texto);
  if (conSeparador) {
    const [, h, m, s = '00'] = conSeparador;
    return Number(h) < 24 && Number(m) < 60 ? `${h!.padStart(2, '0')}:${m}:${s}` : null;
  }
  if (/^\d{3,6}$/.test(texto)) {
    const p = texto.padStart(6, '0');
    const h = Number(p.slice(0, 2));
    const m = Number(p.slice(2, 4));
    const s = Number(p.slice(4, 6));
    if (h < 24 && m < 60 && s < 60) return `${p.slice(0, 2)}:${p.slice(2, 4)}:${p.slice(4, 6)}`;
  }
  return null;
}

/** Celdas vacías o con un espacio → null (precisión de diseño de 9.5). */
export function vacioANull<T>(valor: T): T | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string' && valor.trim() === '') return null;
  return valor;
}

/** S/N de los días de operación; acepta minúsculas y espacios. */
export function normalizarSN(valor: unknown): 'S' | 'N' | null {
  const v = String(valor ?? '')
    .trim()
    .toUpperCase();
  return v === 'S' || v === 'N' ? v : null;
}

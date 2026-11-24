import type { DiaSemana } from './tipos.ts';

export const ZONA_NEGOCIO = 'America/Santiago';

/**
 * RN-06 / RNF-10: las horas se almacenan en UTC y la «fecha del día» se calcula en
 * America/Santiago (con manejo de cambio de horario). Devuelve YYYY-MM-DD.
 */
export function fechaLocal(instante: Date | string, zona = ZONA_NEGOCIO): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  if (Number.isNaN(d.getTime())) throw new Error(`Instante inválido: ${String(instante)}`);
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hora local HH:MM:SS de un instante en la zona de negocio. */
export function horaLocal(instante: Date | string, zona = ZONA_NEGOCIO): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD. */
export function diaSemana(fechaISO: string): DiaSemana {
  const [y, m, d] = fechaISO.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return (dow === 0 ? 7 : dow) as DiaSemana;
}

const ETIQUETAS_DIA: Record<DiaSemana, string> = {
  1: 'lu',
  2: 'ma',
  3: 'mi',
  4: 'ju',
  5: 'vi',
  6: 'sá',
  7: 'do',
};

const NOMBRES_DIA: Record<DiaSemana, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

/** RF-13: etiqueta del eje X «dd + número de día», por ejemplo «mi 30». */
export function etiquetaDia(fechaISO: string): string {
  return `${ETIQUETAS_DIA[diaSemana(fechaISO)]} ${Number(fechaISO.slice(8, 10))}`;
}

/** Cabecera del bloque de detalle, por ejemplo «30/9/2026 Miércoles». */
export function cabeceraFecha(fechaISO: string): string {
  const [y, m, d] = fechaISO.split('-').map(Number) as [number, number, number];
  return `${d}/${m}/${y} ${NOMBRES_DIA[diaSemana(fechaISO)]}`;
}

/** Fechas YYYY-MM-DD de un mes. */
export function diasDelMes(anio: number, mes: number): string[] {
  const total = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return Array.from(
    { length: total },
    (_, i) => `${anio}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  );
}

/** Minutos desde medianoche para HH:MM[:SS]. */
export function minutosDelDia(hora: string): number {
  const [h = 0, m = 0, s = 0] = hora.split(':').map(Number);
  return h * 60 + m + s / 60;
}

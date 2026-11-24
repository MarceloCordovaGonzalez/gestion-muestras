/** Colores consistentes del Sistema (Especificación Funcional v1.4, 8.2). */
export const COLORES = {
  retiro: '#1F5FD1',
  entrega: '#C2187A',
  fueraDeRuta: '#E67E22',
  error: '#7F8C8D',
  errorAlerta: '#C0392B',
} as const;

/** Fecha local de hoy (America/Santiago) en YYYY-MM-DD. */
export const hoy = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

export const formatoPorcentaje = (v: number | null): string =>
  v === null
    ? '—'
    : `${v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

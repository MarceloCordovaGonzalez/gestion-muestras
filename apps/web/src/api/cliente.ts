import { obtenerToken } from '../auth/sesion';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/v1';

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

async function solicitar<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const token = await obtenerToken();
  const r = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const cuerpo = (await r.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(cuerpo.message) ? cuerpo.message.join('; ') : cuerpo.message;
    throw new ErrorApi(r.status, msg ?? `Error ${r.status}`);
  }
  return (await r.json()) as T;
}

const qs = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') s.set(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : '';
};

// ---- Tipos (alineados con packages/contracts/openapi.yaml) ----
export interface DetalleDiario {
  fecha: string;
  cabecera: string;
  retirosPlanificados: number;
  retirosRealizados: number;
  entregasRealizadas: number;
  errores: number;
  porcentajeRetiros: number | null;
  porcentajeErrores: number | null;
  retirosFueraDeRuta: number;
}

export interface PuntoTendencia {
  fecha: string;
  etiqueta: string;
  retiros: number;
  entregas: number;
  conFueraDeRuta: boolean;
}

export interface PuntoMapa {
  clave: string;
  tipo: 'R' | 'E' | 'ERROR';
  codigo: number | null;
  alias: string | null;
  comuna: string;
  lat: number;
  lon: number;
  radio: number | null;
  cantidad: number;
  fuera_de_ruta: number;
  marcaciones: { idvia: string; rutcon: number; hora: string; estvia: string; fueraruta: string }[];
}

export interface Aviso {
  idavi: string;
  tipo: string;
  rutcon: number | null;
  alicen: string | null;
  hora: string | null;
  leido: boolean;
}

export interface ResumenImportacion {
  idimp: string;
  hojasImportadas: string[];
  hojasIgnoradas: string[];
  avisos: string[];
  errores: { hoja: string; fila: number | null; mensaje: string }[];
  conteo: Record<string, number>;
  geocercasSolapadas: { codcenA: number; codcenB: number; distancia: number }[];
}

export const api = {
  detalle: (fecha: string, comuna?: string) =>
    solicitar<DetalleDiario>(`/dashboard/detalle${qs({ fecha, comuna })}`),
  tendencia: (mes: string, comuna?: string) =>
    solicitar<PuntoTendencia[]>(`/dashboard/tendencia${qs({ mes, comuna })}`),
  mapa: (f: { fecha: string; comuna?: string; tipo?: string; conductor?: string }) =>
    solicitar<PuntoMapa[]>(`/mapa${qs(f)}`),
  avisos: (fecha: string) => solicitar<Aviso[]>(`/avisos${qs({ fecha })}`),
  validarImportacion: (archivo: File) => {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return solicitar<ResumenImportacion>('/importaciones', { method: 'POST', body: fd });
  },
  confirmarImportacion: (idimp: string) =>
    solicitar<{ estado: string }>(`/importaciones/${idimp}/confirmar`, { method: 'POST' }),
};

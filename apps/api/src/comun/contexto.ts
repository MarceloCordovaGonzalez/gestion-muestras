export type Perfil = 'CONDUCTOR' | 'ADMINISTRADOR';

/** Identidad resuelta desde el JWT de Identity Platform (claims personalizados). */
export interface UsuarioAutenticado {
  uid: string;
  perfil: Perfil;
  /** RN-20: la empresa sale del token, nunca del código. */
  codemp: string;
  /** Presente cuando quien marca es conductor o Administrador vinculado a CONDUCTOR (RN-23). */
  rutcon: number | null;
  /** Dispositivo enrolado (CU-01). Obligatorio para marcar. */
  iddis: string | null;
  correo: string | null;
  /** Número verificado por OTP (claim phone_number). Se usa en el enrolamiento (CU-01). */
  telefono: string | null;
  /** true si el token aún no tiene claims de negocio (antes del enrolamiento). */
  enrolamientoPendiente: boolean;
}

declare module 'express' {
  interface Request {
    usuario?: UsuarioAutenticado;
    idCorrelacion?: string;
  }
}

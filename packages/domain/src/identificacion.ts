/** Validaciones de identificación (RN-01, Especificación Funcional v1.4, 9.3). */

/** Dígito verificador del RUT chileno (módulo 11). */
export function calcularDigitoVerificador(cuerpo: number): string {
  if (!Number.isInteger(cuerpo) || cuerpo <= 0) throw new Error('RUT inválido');
  let suma = 0;
  let factor = 2;
  for (const d of String(cuerpo).split('').reverse()) {
    suma += Number(d) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
}

export function validarRut(cuerpo: number, dv: string): boolean {
  try {
    return calcularDigitoVerificador(cuerpo) === dv.trim().toUpperCase();
  } catch {
    return false;
  }
}

/**
 * RN-01: celular en formato E.164 (+569XXXXXXXX). La planilla lo trae como número de 9 dígitos.
 * Devuelve null si no es un móvil chileno válido.
 */
export function normalizarCelularChile(entrada: string | number): string | null {
  const digitos = String(entrada).replace(/\D/g, '');
  let nacional: string;
  if (digitos.length === 11 && digitos.startsWith('569')) nacional = digitos.slice(2);
  else if (digitos.length === 9 && digitos.startsWith('9')) nacional = digitos;
  else if (digitos.length === 8) nacional = `9${digitos}`;
  else return null;
  return /^9\d{8}$/.test(nacional) ? `+56${nacional}` : null;
}

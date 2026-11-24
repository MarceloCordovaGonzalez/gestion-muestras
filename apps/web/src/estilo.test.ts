import { describe, expect, it } from 'vitest';
import { COLORES, formatoPorcentaje } from './estilo';

describe('estilo', () => {
  it('RN-12/RN-13: porcentaje nulo se muestra «—»', () => {
    expect(formatoPorcentaje(null)).toBe('—');
  });
  it('porcentaje con un decimal y coma decimal', () => {
    expect(formatoPorcentaje(6.7)).toBe('6,7 %');
    expect(formatoPorcentaje(40)).toBe('40,0 %');
  });
  it('colores de la especificación 8.2', () => {
    expect(COLORES).toMatchObject({
      retiro: '#1F5FD1',
      entrega: '#C2187A',
      fueraDeRuta: '#E67E22',
    });
  });
});

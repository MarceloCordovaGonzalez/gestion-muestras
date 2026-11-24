import { useQuery } from '@tanstack/react-query';
import { api } from '../api/cliente';
import { hoy } from '../estilo';

const TITULOS: Record<string, string> = {
  RETIRO_FUERA_DE_RUTA: 'Retiro fuera de ruta',
  MARCACION_SOSPECHOSA: 'Errores reiterados del conductor',
  ENTREGA_LAB_DISTINTO: 'Entrega en laboratorio distinto',
};

/** CU-07 (MVP1): avisos en la web del Administrador. */
export function Avisos() {
  const avisos = useQuery({
    queryKey: ['avisos', hoy()],
    queryFn: () => api.avisos(hoy()),
    refetchInterval: 60_000,
  });
  return (
    <section>
      <h1>Avisos del día</h1>
      {avisos.isError && <p role="alert">No fue posible cargar los avisos.</p>}
      {avisos.data?.length === 0 && <p>Sin avisos.</p>}
      <ul className="avisos">
        {avisos.data?.map((a) => (
          <li key={a.idavi} className={a.tipo === 'RETIRO_FUERA_DE_RUTA' ? 'fuera' : ''}>
            <strong>{TITULOS[a.tipo] ?? a.tipo}</strong> · {a.hora ?? ''} · conductor{' '}
            {a.rutcon ?? '—'}
            {a.alicen ? ` · ${a.alicen}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Contador para el menú: retiros fuera de ruta del día. */
export function useCantidadFueraDeRuta(): number {
  const q = useQuery({
    queryKey: ['avisos', hoy()],
    queryFn: () => api.avisos(hoy()),
    refetchInterval: 60_000,
  });
  return q.data?.filter((a) => a.tipo === 'RETIRO_FUERA_DE_RUTA').length ?? 0;
}

import { useQuery } from '@tanstack/react-query';
import { AdvancedMarker, APIProvider, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useState } from 'react';
import { api, type PuntoMapa } from '../api/cliente';
import { COLORES, hoy } from '../estilo';
import { MapaOsm } from './MapaOsm';

const CENTRO_SANTIAGO = { lat: -33.4489, lng: -70.6693 };
const CLAVE_MAPS = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

/** CU-03 Visualizar retiros y entregas en mapa (RF-10 a RF-12, RF-27). */
export function Mapa() {
  const [fecha, setFecha] = useState(hoy());
  const [comuna, setComuna] = useState('');
  const [tipo, setTipo] = useState('');
  const [conductor, setConductor] = useState('');
  const [seleccion, setSeleccion] = useState<PuntoMapa | null>(null);

  const puntos = useQuery({
    queryKey: ['mapa', fecha, comuna, tipo, conductor],
    queryFn: () =>
      api.mapa({
        fecha,
        comuna: comuna || undefined,
        tipo: tipo || undefined,
        conductor: conductor || undefined,
      }),
    refetchInterval: fecha === hoy() ? 60_000 : false, // actualización automática (MEJ-13)
  });

  return (
    <section>
      <header className="filtros">
        <h1>Mapa de retiros y entregas</h1>
        <label>
          Fecha{' '}
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value || hoy())}
          />
        </label>
        <label>
          Comuna{' '}
          <input
            value={comuna}
            placeholder="Todas"
            onChange={(e) => setComuna(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="R">Retiros</option>
            <option value="E">Entregas</option>
            <option value="ERROR">Errores</option>
            <option value="FUERA_RUTA">Fuera de ruta</option>
          </select>
        </label>
        <label>
          Conductor (RUT){' '}
          <input
            inputMode="numeric"
            value={conductor}
            onChange={(e) => setConductor(e.target.value.replace(/\D/g, ''))}
          />
        </label>
      </header>

      <Leyenda />
      {puntos.isError && <p role="alert">No fue posible cargar las marcaciones.</p>}

      <div className="mapa">
        {CLAVE_MAPS === '' ? (
          // Sin clave de Google Maps (desarrollo local): mapa OpenStreetMap (alternativa de ADR-05).
          <MapaOsm puntos={puntos.data ?? []} ajustar={comuna !== ''} />
        ) : (
          <APIProvider apiKey={CLAVE_MAPS}>
            <Map
              defaultCenter={CENTRO_SANTIAGO}
              defaultZoom={11}
              mapId="gm-mapa"
              gestureHandling="greedy"
            >
              {(puntos.data ?? []).map((p) => (
                <AdvancedMarker
                  key={p.clave}
                  position={{ lat: p.lat, lng: p.lon }}
                  onClick={() => setSeleccion(p)}
                >
                  <Marcador p={p} />
                </AdvancedMarker>
              ))}
              {seleccion && (
                <InfoWindow
                  position={{ lat: seleccion.lat, lng: seleccion.lon }}
                  onCloseClick={() => setSeleccion(null)}
                >
                  <Detalle p={seleccion} />
                </InfoWindow>
              )}
              <AjustarZoom puntos={comuna ? (puntos.data ?? []) : []} />
            </Map>
          </APIProvider>
        )}
      </div>
    </section>
  );
}

/** Círculo azul (R) / magenta (E) / gris (error) con bandera de cantidad (RN-18). */
function Marcador({ p }: { p: PuntoMapa }) {
  const color = p.tipo === 'R' ? COLORES.retiro : p.tipo === 'E' ? COLORES.entrega : COLORES.error;
  const fuera = p.fuera_de_ruta > 0;
  return (
    <div
      className="marcador"
      style={{
        background: color,
        boxShadow: fuera ? `0 0 0 4px ${COLORES.fueraDeRuta}` : undefined,
      }}
      title={`${p.alias ?? 'Error'} · ${p.cantidad}`}
    >
      <span className="bandera">{p.cantidad}</span>
      {fuera && (
        <span className="advertencia" aria-label="Fuera de ruta">
          ⚠
        </span>
      )}
    </div>
  );
}

export function Detalle({ p }: { p: PuntoMapa }) {
  return (
    <div className="detalle-punto">
      <strong>{p.alias ?? 'Marcación en error'}</strong>
      <div>
        {p.comuna}
        {p.radio ? ` · radio ${p.radio} m` : ''}
      </div>
      <ul>
        {p.marcaciones.map((m) => (
          <li key={m.idvia}>
            {m.hora} · conductor {m.rutcon} · {m.estvia}
            {m.fueraruta === 'S' && (
              <span style={{ color: COLORES.fueraDeRuta }}> · fuera de ruta</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Al filtrar por comuna, centra y ajusta el zoom a los puntos resultantes. */
function AjustarZoom({ puntos }: { puntos: PuntoMapa[] }) {
  const mapa = useMap();
  useEffect(() => {
    if (!mapa || puntos.length === 0) return;
    const b = new google.maps.LatLngBounds();
    puntos.forEach((p) => b.extend({ lat: p.lat, lng: p.lon }));
    mapa.fitBounds(b, 60);
  }, [mapa, puntos]);
  return null;
}

export function Leyenda() {
  const item = (color: string, texto: string, anillo = false) => (
    <span className="leyenda-item">
      <i
        style={{
          background: anillo ? 'transparent' : color,
          border: anillo ? `3px solid ${color}` : undefined,
        }}
      />
      {texto}
    </span>
  );
  return (
    <div className="leyenda">
      {item(COLORES.retiro, 'Retiro')}
      {item(COLORES.entrega, 'Entrega')}
      {item(COLORES.fueraDeRuta, 'Retiro fuera de ruta', true)}
      {item(COLORES.error, 'Error')}
    </div>
  );
}

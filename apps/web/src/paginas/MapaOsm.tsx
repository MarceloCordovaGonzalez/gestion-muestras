import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import type { PuntoMapa } from '../api/cliente';
import { COLORES } from '../estilo';
import { Detalle } from './Mapa';

const CENTRO_SANTIAGO: [number, number] = [-33.4489, -70.6693];

/**
 * Mapa con OpenStreetMap y Leaflet, usado cuando no hay clave de Google Maps (desarrollo local).
 * Misma semántica que el mapa principal (RF-11, RN-18, RF-27): azul = retiro, magenta = entrega,
 * gris = error, anillo naranja = fuera de ruta, bandera con la cantidad y geocerca del punto.
 */
export function MapaOsm({ puntos, ajustar }: { puntos: PuntoMapa[]; ajustar: boolean }) {
  return (
    <MapContainer center={CENTRO_SANTIAGO} zoom={11} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {puntos.map((p) => {
        const color =
          p.tipo === 'R' ? COLORES.retiro : p.tipo === 'E' ? COLORES.entrega : COLORES.error;
        const fuera = p.fuera_de_ruta > 0;
        return (
          <CircleMarker
            key={p.clave}
            center={[p.lat, p.lon]}
            radius={11}
            pathOptions={{
              color: fuera ? COLORES.fueraDeRuta : '#ffffff',
              weight: fuera ? 4 : 2,
              fillColor: color,
              fillOpacity: 0.95,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              {p.cantidad}
              {fuera ? ' ⚠' : ''}
            </Tooltip>
            <Popup>
              <Detalle p={p} />
            </Popup>
          </CircleMarker>
        );
      })}
      {puntos
        .filter((p) => p.radio)
        .map((p) => (
          <Circle
            key={`g-${p.clave}`}
            center={[p.lat, p.lon]}
            radius={p.radio!}
            pathOptions={{ color: '#64748b', weight: 1, fillOpacity: 0.05, dashArray: '4' }}
          />
        ))}
      <AjustarVista puntos={ajustar ? puntos : []} />
    </MapContainer>
  );
}

function AjustarVista({ puntos }: { puntos: PuntoMapa[] }) {
  const mapa = useMap();
  useEffect(() => {
    if (puntos.length > 0)
      mapa.fitBounds(
        puntos.map((p) => [p.lat, p.lon]),
        { padding: [40, 40] },
      );
  }, [mapa, puntos]);
  return null;
}

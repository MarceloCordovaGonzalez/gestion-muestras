import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { cerrarSesion, iniciarSesion, observarSesion } from './auth/sesion';
import { Avisos, useCantidadFueraDeRuta } from './paginas/Avisos';
import { Dashboard } from './paginas/Dashboard';
import { Importacion } from './paginas/Importacion';
import { Mapa } from './paginas/Mapa';

export function App() {
  const [sesion, setSesion] = useState<'cargando' | 'sin-sesion' | 'activa'>('cargando');
  useEffect(() => observarSesion((u) => setSesion(u ? 'activa' : 'sin-sesion')), []);

  if (sesion === 'cargando') return <p className="centrado">Cargando…</p>;
  if (sesion === 'sin-sesion') return <Ingreso />;
  return (
    <div className="layout">
      <Menu />
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/avisos" element={<Avisos />} />
          <Route path="/maestros/importacion" element={<Importacion />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/** Menú del Piloto 1 (Especificación 8.2). Cumplimiento, Errores y Reportes llegan en releases siguientes. */
function Menu() {
  const fueraDeRuta = useCantidadFueraDeRuta();
  return (
    <nav className="menu" aria-label="Menú principal">
      <strong className="marca">Gestión de Muestras</strong>
      <NavLink to="/" end>
        Inicio
      </NavLink>
      <NavLink to="/mapa">Mapa</NavLink>
      <NavLink to="/avisos">
        Retiros fuera de ruta {fueraDeRuta > 0 && <span className="insignia">{fueraDeRuta}</span>}
      </NavLink>
      <NavLink to="/maestros/importacion">Importar maestros</NavLink>
      <button className="salir" onClick={() => void cerrarSesion()}>
        Salir
      </button>
    </nav>
  );
}

function Ingreso() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await iniciarSesion(correo, clave);
    } catch {
      setError('Credenciales inválidas o segundo factor pendiente.');
    }
  };
  return (
    <form className="ingreso" onSubmit={enviar}>
      <h1>Ingreso del Administrador</h1>
      <label>
        Correo{' '}
        <input
          type="email"
          autoComplete="username"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />
      </label>
      <label>
        Contraseña{' '}
        <input
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">Ingresar</button>
    </form>
  );
}

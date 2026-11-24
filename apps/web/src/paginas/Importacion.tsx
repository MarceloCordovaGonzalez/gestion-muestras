import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type ResumenImportacion } from '../api/cliente';

/** CU-05: importación validada de la planilla (RF-16 con reparo: la hoja VIAJE se ignora). */
export function Importacion() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);

  const validar = useMutation({ mutationFn: api.validarImportacion, onSuccess: setResumen });
  const confirmar = useMutation({ mutationFn: api.confirmarImportacion });

  return (
    <section>
      <h1>Importar datos maestros</h1>
      <p>
        Hojas que se importan: CENTRO, LABORATORIO, CONDUCTOR y RUTA CONDUCTOR. La hoja VIAJE no se
        importa: la lista Viaje se inicia vacía en producción.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (archivo) {
            confirmar.reset();
            validar.mutate(archivo);
          }
        }}
      >
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!archivo || validar.isPending}>
          {validar.isPending ? 'Validando…' : 'Validar planilla'}
        </button>
      </form>
      {validar.isError && <p role="alert">{validar.error.message}</p>}

      {resumen && (
        <div className="tarjeta">
          <h2>Resumen de validación</h2>
          <ul>
            {Object.entries(resumen.conteo).map(([hoja, n]) => (
              <li key={hoja}>
                {hoja}: {n} registros
              </li>
            ))}
          </ul>
          {resumen.avisos.map((a) => (
            <p key={a} className="aviso">
              {a}
            </p>
          ))}
          {resumen.geocercasSolapadas.length > 0 && (
            <>
              <h3>Geocercas solapadas (advertencia)</h3>
              <ul>
                {resumen.geocercasSolapadas.map((s) => (
                  <li key={`${s.codcenA}-${s.codcenB}`}>
                    Centros {s.codcenA} y {s.codcenB} a {s.distancia} m
                  </li>
                ))}
              </ul>
            </>
          )}
          {resumen.errores.length > 0 ? (
            <>
              <h3>Errores ({resumen.errores.length}) — corrija la planilla y vuelva a validar</h3>
              <table>
                <thead>
                  <tr>
                    <th>Hoja</th>
                    <th>Fila</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.errores.map((e, i) => (
                    <tr key={i}>
                      <td>{e.hoja}</td>
                      <td>{e.fila ?? '—'}</td>
                      <td>{e.mensaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <button
              onClick={() => confirmar.mutate(resumen.idimp)}
              disabled={confirmar.isPending || confirmar.isSuccess}
            >
              {confirmar.isSuccess ? 'Importación aplicada' : 'Confirmar e importar'}
            </button>
          )}
          {confirmar.isError && <p role="alert">{confirmar.error.message}</p>}
        </div>
      )}
    </section>
  );
}

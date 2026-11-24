import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { useMemo, useState } from 'react';
import { api, type DetalleDiario } from '../api/cliente';
import { COLORES, formatoPorcentaje, hoy } from '../estilo';

/** CU-04 Visualizar tablero de reporte tipo dashboard (RF-13 a RF-15). */
export function Dashboard() {
  const [fecha, setFecha] = useState(hoy());
  const [comuna, setComuna] = useState('');
  const mes = fecha.slice(0, 7);
  const esHoy = fecha === hoy();

  const tendencia = useQuery({
    queryKey: ['tendencia', mes, comuna],
    queryFn: () => api.tendencia(mes, comuna || undefined),
    refetchInterval: esHoy ? 60_000 : false,
  });
  const detalle = useQuery({
    queryKey: ['detalle', fecha, comuna],
    queryFn: () => api.detalle(fecha, comuna || undefined),
    refetchInterval: esHoy ? 60_000 : false,
  });

  const opcion = useMemo(() => {
    const serie = tendencia.data ?? [];
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Retiros', 'Entregas'] },
      grid: { left: 40, right: 20, bottom: 40, top: 40 },
      xAxis: { type: 'category', data: serie.map((p) => p.etiqueta) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          name: 'Retiros',
          type: 'line',
          data: serie.map((p) => p.retiros),
          itemStyle: { color: COLORES.retiro },
          lineStyle: { color: COLORES.retiro },
          // Propuesta: triángulo naranja en días con retiros fuera de ruta.
          markPoint: {
            symbol: 'triangle',
            symbolSize: 12,
            itemStyle: { color: COLORES.fueraDeRuta },
            data: serie.flatMap((p, i) =>
              p.conFueraDeRuta ? [{ coord: [i, p.retiros], value: '' }] : [],
            ),
          },
        },
        {
          name: 'Entregas',
          type: 'line',
          data: serie.map((p) => p.entregas),
          itemStyle: { color: COLORES.entrega },
          lineStyle: { color: COLORES.entrega },
        },
      ],
    };
  }, [tendencia.data]);

  const alHacerClic = {
    click: (e: { dataIndex?: number }) => {
      const p = e.dataIndex !== undefined ? tendencia.data?.[e.dataIndex] : undefined;
      if (p) setFecha(p.fecha); // RF-15: seleccionar fecha haciendo clic en el gráfico
    },
  };

  return (
    <section>
      <header className="filtros">
        <h1>Dashboard</h1>
        <label>
          Fecha{' '}
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value || hoy())} />
        </label>
        <label>
          Comuna{' '}
          <input
            value={comuna}
            placeholder="Todas"
            onChange={(e) => setComuna(e.target.value.toUpperCase())}
          />
        </label>
      </header>

      <div className="tarjeta">
        {tendencia.isError ? (
          <p role="alert">No fue posible cargar la tendencia.</p>
        ) : (
          <ReactECharts option={opcion} onEvents={alHacerClic} style={{ height: 320 }} notMerge />
        )}
      </div>

      <h2>Fecha: {detalle.data?.cabecera ?? fecha}</h2>
      {detalle.isLoading && <p>Cargando…</p>}
      {detalle.isError && <p role="alert">No fue posible cargar el detalle.</p>}
      {detalle.data && <Cuadros d={detalle.data} />}
    </section>
  );
}

function Cuadros({ d }: { d: DetalleDiario }) {
  const cuadros: { titulo: string; valor: string; color?: string }[] = [
    { titulo: 'Retiros planificados', valor: String(d.retirosPlanificados) },
    { titulo: 'Retiros realizados', valor: String(d.retirosRealizados), color: COLORES.retiro },
    { titulo: 'Entregas realizadas', valor: String(d.entregasRealizadas), color: COLORES.entrega },
    { titulo: 'Errores', valor: String(d.errores), color: COLORES.errorAlerta },
    { titulo: '% retiros realizados', valor: formatoPorcentaje(d.porcentajeRetiros) },
    { titulo: '% errores', valor: formatoPorcentaje(d.porcentajeErrores) },
    {
      titulo: 'Retiros fuera de ruta',
      valor: String(d.retirosFueraDeRuta),
      color: COLORES.fueraDeRuta,
    },
  ];
  return (
    <div className="cuadros">
      {cuadros.map((c, i) => (
        <div
          key={c.titulo}
          className="cuadro"
          style={c.color ? { borderTopColor: c.color } : undefined}
        >
          <span className="cuadro-num">{i + 1}</span>
          <span className="cuadro-titulo">{c.titulo}</span>
          <strong className="cuadro-valor">{c.valor}</strong>
        </div>
      ))}
    </div>
  );
}

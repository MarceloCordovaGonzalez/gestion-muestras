import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  calcularPendientesDeEntrega,
  cabeceraFecha,
  type DetalleDiario,
  diasDelMes,
  etiquetaDia,
  fechaLocal,
  type Viaje,
} from '@gm/domain';
import { Roles, UsuarioActual } from '../../comun/auth/roles.js';
import type { UsuarioAutenticado } from '../../comun/contexto.js';
import { PrismaService, type Tx } from '../../comun/prisma.service.js';
import { aCentro } from '../marcaciones/marcaciones.service.js';
import { ParametrosService } from '../parametros/parametros.service.js';
import { PlanificacionService } from '../planificacion/planificacion.service.js';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const validarFecha = (f?: string): string => {
  const fecha = f ?? fechaLocal(new Date());
  if (!FECHA_RE.test(fecha)) throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
  return fecha;
};

interface FilaPuntoMapa {
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

/** CU-03 y CU-04: consultas del Administrador. Indicadores calculados en línea (ADR-06). */
@Injectable()
export class ConsultasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
    private readonly planificacion: PlanificacionService,
  ) {}

  /**
   * CU-03: puntos agrupados por centro o laboratorio (RN-18); errores agrupados por celda de
   * ~50 m. El filtro de comuna usa Viaje.COMUNA e incluye errores (RN-17).
   */
  mapa(codemp: string, fecha: string, comuna?: string, tipo?: string, rutcon?: number) {
    return this.prisma.enEmpresa(
      codemp,
      (tx) => tx.$queryRaw<FilaPuntoMapa[]>`
      WITH v AS (
        SELECT * FROM viaje
        WHERE codemp = ${codemp} AND fecvia = ${fecha}::date
          AND (${comuna ?? null}::text IS NULL OR comuna = ${comuna ?? null})
          AND (${rutcon ?? null}::int IS NULL OR rutcon = ${rutcon ?? null})
          AND (${tipo ?? null}::text IS NULL
               OR (${tipo ?? null} = 'R' AND tipvia = 'R')
               OR (${tipo ?? null} = 'E' AND tipvia = 'E')
               OR (${tipo ?? null} = 'ERROR' AND estvia = 'ERROR')
               OR (${tipo ?? null} = 'FUERA_RUTA' AND fueraruta = 'S'))
      ), agrupado AS (
        SELECT CASE WHEN v.tipvia = 'R' THEN 'R-' || v.codcen
                    WHEN v.tipvia = 'E' THEN 'E-' || v.codlab
                    ELSE 'X-' || ST_SnapToGrid(v.geo::geometry, 0.00045)::text END AS clave,
               COALESCE(v.tipvia, 'ERROR') AS tipo, COALESCE(v.codcen, v.codlab) AS codigo, v.*
        FROM v
      )
      SELECT a.clave, a.tipo, a.codigo,
             MAX(COALESCE(c.alicen, l.alilab)) AS alias,
             MAX(a.comuna) AS comuna,
             COALESCE(MAX(c.latcen), MAX(l.latlab), AVG(a.latvia))::float8 AS lat,
             COALESCE(MAX(c.loncen), MAX(l.lonlab), AVG(a.lonvia))::float8 AS lon,
             MAX(COALESCE(c.radcen, l.radlab)) AS radio,
             COUNT(*)::int AS cantidad,
             COUNT(*) FILTER (WHERE a.fueraruta = 'S')::int AS fuera_de_ruta,
             json_agg(json_build_object(
               'idvia', a.idvia, 'rutcon', a.rutcon, 'estvia', a.estvia, 'fueraruta', a.fueraruta,
               'hora', to_char(a.datevia AT TIME ZONE 'America/Santiago', 'HH24:MI:SS'))
               ORDER BY a.datevia) AS marcaciones
      FROM agrupado a
      LEFT JOIN centro c ON a.tipo = 'R' AND c.codemp = a.codemp AND c.codcen = a.codcen
      LEFT JOIN laboratorio l ON a.tipo = 'E' AND l.codemp = a.codemp AND l.codlab = a.codlab
      GROUP BY a.clave, a.tipo, a.codigo
      ORDER BY a.tipo, a.codigo`,
    );
  }

  /** RF-13: serie diaria de R y E CORRECTOS del mes (YYYY-MM). */
  async tendencia(codemp: string, mes: string, comuna?: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(mes);
    if (!m) throw new BadRequestException('mes debe tener formato YYYY-MM');
    const [anio, numMes] = [Number(m[1]), Number(m[2])];
    const filas = await this.prisma.enEmpresa(
      codemp,
      (tx) => tx.$queryRaw<{ fecha: string; retiros: number; entregas: number; fuera: number }[]>`
      SELECT to_char(fecvia, 'YYYY-MM-DD') AS fecha,
             COUNT(*) FILTER (WHERE tipvia = 'R')::int AS retiros,
             COUNT(*) FILTER (WHERE tipvia = 'E')::int AS entregas,
             COUNT(*) FILTER (WHERE fueraruta = 'S')::int AS fuera
      FROM viaje
      WHERE codemp = ${codemp} AND estvia = 'CORRECTO'
        AND fecvia BETWEEN ${`${mes}-01`}::date AND (${`${mes}-01`}::date + interval '1 month - 1 day')::date
        AND (${comuna ?? null}::text IS NULL OR comuna = ${comuna ?? null})
      GROUP BY fecvia`,
    );
    const porFecha = new Map(filas.map((f) => [f.fecha, f]));
    return diasDelMes(anio, numMes).map((fecha) => ({
      fecha,
      etiqueta: etiquetaDia(fecha),
      retiros: porFecha.get(fecha)?.retiros ?? 0,
      entregas: porFecha.get(fecha)?.entregas ?? 0,
      conFueraDeRuta: (porFecha.get(fecha)?.fuera ?? 0) > 0,
    }));
  }

  /** CU-04: los siete cuadros del día (RN-08 a RN-13 y RN-21). */
  async detalle(
    codemp: string,
    fecha: string,
    comuna?: string,
  ): Promise<DetalleDiario & { cabecera: string }> {
    return this.prisma.enEmpresa(codemp, async (tx) => {
      const planificados = await this.planificacion.contarPlanificados(tx, codemp, fecha, comuna);
      const [k] = await tx.$queryRaw<{ r: number; e: number; err: number; fr: number }[]>`
        SELECT COUNT(*) FILTER (WHERE estvia = 'CORRECTO' AND tipvia = 'R')::int AS r,
               COUNT(*) FILTER (WHERE estvia = 'CORRECTO' AND tipvia = 'E')::int AS e,
               COUNT(*) FILTER (WHERE estvia = 'ERROR')::int AS err,
               COUNT(*) FILTER (WHERE estvia = 'CORRECTO' AND tipvia = 'R' AND fueraruta = 'S')::int AS fr
        FROM viaje
        WHERE codemp = ${codemp} AND fecvia = ${fecha}::date
          AND (${comuna ?? null}::text IS NULL OR comuna = ${comuna ?? null})`;
      const pct = (n: number) =>
        planificados === 0 ? null : Math.round((n / planificados) * 1000) / 10;
      return {
        fecha,
        cabecera: cabeceraFecha(fecha),
        retirosPlanificados: planificados,
        retirosRealizados: k?.r ?? 0,
        entregasRealizadas: k?.e ?? 0,
        errores: k?.err ?? 0,
        porcentajeRetiros: pct(k?.r ?? 0),
        porcentajeErrores: pct(k?.err ?? 0),
        retirosFueraDeRuta: k?.fr ?? 0,
      };
    });
  }

  /** RN-16 / MEJ-18: solo disponible si el indicador `pendientesEntrega` está activo (MVP2). */
  async pendientesEntrega(codemp: string, fecha: string) {
    const params = await this.parametros.obtenerDeEmpresa(codemp);
    if (!params.indicadores.pendientesEntrega) {
      throw new NotFoundException('Funcionalidad no habilitada (MEJ-18 pendiente de aprobación).');
    }
    return this.prisma.enEmpresa(codemp, async (tx) => {
      const viajes = await this.viajesDelDia(tx, codemp, fecha);
      const centros = (
        await tx.$queryRaw<Parameters<typeof aCentro>[0][]>`
        SELECT codcen, comcen, alicen, radcen, codlab, estcen, latcen::float8 AS lat, loncen::float8 AS lon,
               lun, mar, mie, jue, vie, sab, dom FROM centro WHERE codemp = ${codemp}`
      ).map(aCentro);
      return calcularPendientesDeEntrega(
        fecha,
        viajes,
        centros,
        new Date(),
        params.plazoPendienteHoras,
      );
    });
  }

  avisos(codemp: string, fecha: string) {
    return this.prisma.enEmpresa(
      codemp,
      (tx) => tx.$queryRaw`
      SELECT a.idavi, a.tipo, a.rutcon, a.detalle, a.leido, a.datecre,
             v.codcen, c.alicen, to_char(v.datevia AT TIME ZONE 'America/Santiago', 'HH24:MI:SS') AS hora
      FROM aviso a
      LEFT JOIN viaje v ON v.idvia = a.idvia
      LEFT JOIN centro c ON c.codemp = v.codemp AND c.codcen = v.codcen
      WHERE a.codemp = ${codemp} AND a.fecavi = ${fecha}::date
      ORDER BY a.datecre DESC`,
    );
  }

  private async viajesDelDia(tx: Tx, codemp: string, fecha: string): Promise<Viaje[]> {
    const filas = await tx.$queryRaw<(Omit<Viaje, 'datevia'> & { datevia: Date })[]>`
      SELECT idvia::text, rutcon, datevia, tipvia, estvia, codcen, codlab, comuna, fueraruta
      FROM viaje WHERE codemp = ${codemp} AND fecvia = ${fecha}::date`;
    return filas.map((f) => ({ ...f, datevia: f.datevia.toISOString() }));
  }
}

@ApiTags('consultas')
@ApiBearerAuth()
@Controller()
export class ConsultasController {
  constructor(private readonly servicio: ConsultasService) {}

  @Get('mapa')
  @Roles('ADMINISTRADOR')
  @ApiQuery({ name: 'tipo', required: false, enum: ['R', 'E', 'ERROR', 'FUERA_RUTA'] })
  mapa(
    @UsuarioActual() u: UsuarioAutenticado,
    @Query('fecha') fecha?: string,
    @Query('comuna') comuna?: string,
    @Query('tipo') tipo?: string,
    @Query('conductor') conductor?: string,
  ) {
    return this.servicio.mapa(
      u.codemp,
      validarFecha(fecha),
      comuna || undefined,
      tipo || undefined,
      conductor ? Number(conductor) : undefined,
    );
  }

  @Get('dashboard/tendencia')
  @Roles('ADMINISTRADOR')
  tendencia(
    @UsuarioActual() u: UsuarioAutenticado,
    @Query('mes') mes?: string,
    @Query('comuna') comuna?: string,
  ) {
    return this.servicio.tendencia(
      u.codemp,
      mes ?? fechaLocal(new Date()).slice(0, 7),
      comuna || undefined,
    );
  }

  @Get('dashboard/detalle')
  @Roles('ADMINISTRADOR')
  detalle(
    @UsuarioActual() u: UsuarioAutenticado,
    @Query('fecha') fecha?: string,
    @Query('comuna') comuna?: string,
  ) {
    return this.servicio.detalle(u.codemp, validarFecha(fecha), comuna || undefined);
  }

  @Get('pendientes-entrega')
  @Roles('ADMINISTRADOR')
  pendientes(@UsuarioActual() u: UsuarioAutenticado, @Query('fecha') fecha?: string) {
    return this.servicio.pendientesEntrega(u.codemp, validarFecha(fecha));
  }

  @Get('avisos')
  @Roles('ADMINISTRADOR')
  avisos(@UsuarioActual() u: UsuarioAutenticado, @Query('fecha') fecha?: string) {
    return this.servicio.avisos(u.codemp, validarFecha(fecha));
  }
}

import { BadRequestException, Controller, Injectable, Logger, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { diaSemana, fechaLocal } from '@gm/domain';
import { Roles, UsuarioActual } from '../../comun/auth/roles.js';
import type { UsuarioAutenticado } from '../../comun/contexto.js';
import { PrismaService, type Tx } from '../../comun/prisma.service.js';

const COLUMNA_DIA = {
  1: 'lun',
  2: 'mar',
  3: 'mie',
  4: 'jue',
  5: 'vie',
  6: 'sab',
  7: 'dom',
} as const;

/**
 * RN-08 y RN-14: generación diaria de RETIRO_PLANIFICADO (anticipada al MVP1, decisión del
 * 30/10/2026). Se ejecuta a las 00:05 America/Santiago (Cloud Scheduler → Cloud Run Job) y es
 * idempotente (UNIQUE codemp, fecpla, idrut).
 */
@Injectable()
export class PlanificacionService {
  private readonly log = new Logger(PlanificacionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generarDia(codemp: string, fecha: string): Promise<number> {
    const col = COLUMNA_DIA[diaSemana(fecha)];
    const dia = diaSemana(fecha);
    const n = await this.prisma.enEmpresa(codemp, (tx) =>
      tx.$executeRawUnsafe(
        // La columna del día proviene de una tabla fija (no de la entrada del usuario).
        `INSERT INTO retiro_planificado (codemp, fecpla, idrut, rutcon, codcen, horpla)
       SELECT r.codemp, $2::date, r.idrut, r.rutcon, r.codcen, r.horrut
       FROM ruta_conductor r
       JOIN centro c ON c.codemp = r.codemp AND c.codcen = r.codcen
       WHERE r.codemp = $1 AND r.estrut = 'ACTIVO' AND c.estcen = 'ACTIVO' AND c.${col} = 'S'
         AND (r.vigdes IS NULL OR r.vigdes <= $2::date) AND (r.vighas IS NULL OR r.vighas >= $2::date)
         AND (r.diasem IS NULL OR r.diasem = $3)
         AND NOT EXISTS (SELECT 1 FROM feriado f WHERE f.codemp = r.codemp AND f.fecha = $2::date)
       ON CONFLICT (codemp, fecpla, idrut) DO NOTHING`,
        codemp,
        fecha,
        dia,
      ),
    );
    this.log.log(`Planificación ${codemp} ${fecha}: ${n} retiros generados`);
    return n;
  }

  /** Cuadro 1 del dashboard (RN-08), con filtro opcional por la comuna del centro. */
  async contarPlanificados(
    tx: Tx,
    codemp: string,
    fecha: string,
    comuna?: string,
  ): Promise<number> {
    const [r] = await tx.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM retiro_planificado p JOIN centro c ON c.codemp = p.codemp AND c.codcen = p.codcen
      WHERE p.codemp = ${codemp} AND p.fecpla = ${fecha}::date
        AND (${comuna ?? null}::text IS NULL OR c.comcen = ${comuna ?? null})`;
    return r?.n ?? 0;
  }
}

/**
 * POST /v1/planificacion/generar?fecha=YYYY-MM-DD – regenera (idempotente) los retiros planificados
 * de una fecha. Útil tras importar o corregir rutas, y en la simulación de desarrollo.
 */
@ApiTags('planificacion')
@ApiBearerAuth()
@Controller('planificacion')
export class PlanificacionController {
  constructor(private readonly servicio: PlanificacionService) {}

  @Post('generar')
  @Roles('ADMINISTRADOR')
  async generar(@UsuarioActual() u: UsuarioAutenticado, @Query('fecha') fecha?: string) {
    const f = fecha ?? fechaLocal(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f))
      throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
    return { fecha: f, generados: await this.servicio.generarDia(u.codemp, f) };
  }
}

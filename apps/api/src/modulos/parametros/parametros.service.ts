import { Body, Controller, Get, Injectable, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { type IndicadoresFuncionalidad, resolverIndicadores } from '@gm/domain';
import { Roles, UsuarioActual } from '../../comun/auth/roles.js';
import type { UsuarioAutenticado } from '../../comun/contexto.js';
import { PrismaService, type Tx } from '../../comun/prisma.service.js';

export interface ParametrosEmpresa {
  toleranciaMin: number;
  umbralAusenciaMin: number;
  radioDefectoM: number;
  ventanaDedupMin: number;
  plazoPendienteHoras: number;
  indicadores: IndicadoresFuncionalidad;
}

interface FilaParametro {
  tolerancia_min: number;
  umbral_ausencia_min: number;
  radio_defecto_m: number;
  ventana_dedup_min: number;
  plazo_pendiente_horas: number;
  feature_deduplicacion: boolean | null;
  feature_pendientes_entrega: boolean | null;
}

/** RF-25: parámetros por empresa, configurables sin despliegue (RNF-11). */
@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(tx: Tx, codemp: string): Promise<ParametrosEmpresa> {
    const [p] = await tx.$queryRaw<FilaParametro[]>`
      SELECT tolerancia_min, umbral_ausencia_min, radio_defecto_m, ventana_dedup_min,
             plazo_pendiente_horas, feature_deduplicacion, feature_pendientes_entrega
      FROM parametro WHERE codemp = ${codemp}`;
    return {
      toleranciaMin: p?.tolerancia_min ?? 15,
      umbralAusenciaMin: p?.umbral_ausencia_min ?? 120,
      radioDefectoM: p?.radio_defecto_m ?? 100,
      ventanaDedupMin: p?.ventana_dedup_min ?? 10,
      plazoPendienteHoras: p?.plazo_pendiente_horas ?? 3,
      indicadores: resolverIndicadores(process.env, {
        ...(p?.feature_deduplicacion != null ? { deduplicacion: p.feature_deduplicacion } : {}),
        ...(p?.feature_pendientes_entrega != null
          ? { pendientesEntrega: p.feature_pendientes_entrega }
          : {}),
      }),
    };
  }

  obtenerDeEmpresa(codemp: string): Promise<ParametrosEmpresa> {
    return this.prisma.enEmpresa(codemp, (tx) => this.obtener(tx, codemp));
  }
}

class ActualizarParametrosDto {
  @IsOptional() @IsInt() @Min(0) @Max(120) toleranciaMin?: number;
  @IsOptional() @IsInt() @Min(10) @Max(1000) radioDefectoM?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) ventanaDedupMin?: number;
  @IsOptional() @IsBoolean() deduplicacion?: boolean;
  // Nota: `pendientesEntrega` (MEJ-18) no es editable desde la API en el Piloto 1.
}

@ApiTags('parametros')
@ApiBearerAuth()
@Controller('parametros')
export class ParametrosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicio: ParametrosService,
  ) {}

  @Get()
  @Roles('ADMINISTRADOR')
  obtener(@UsuarioActual() u: UsuarioAutenticado) {
    return this.servicio.obtenerDeEmpresa(u.codemp);
  }

  @Put()
  @Roles('ADMINISTRADOR')
  async actualizar(@UsuarioActual() u: UsuarioAutenticado, @Body() dto: ActualizarParametrosDto) {
    await this.prisma.enEmpresa(u.codemp, async (tx) => {
      await tx.$executeRaw`
        UPDATE parametro SET
          tolerancia_min = COALESCE(${dto.toleranciaMin ?? null}::smallint, tolerancia_min),
          radio_defecto_m = COALESCE(${dto.radioDefectoM ?? null}::smallint, radio_defecto_m),
          ventana_dedup_min = COALESCE(${dto.ventanaDedupMin ?? null}::smallint, ventana_dedup_min),
          feature_deduplicacion = COALESCE(${dto.deduplicacion ?? null}::boolean, feature_deduplicacion),
          dateact = now()
        WHERE codemp = ${u.codemp}`;
      await tx.$executeRaw`
        INSERT INTO auditoria (codemp, usuario, accion, entidad, valor_nue)
        VALUES (${u.codemp}, ${u.correo ?? u.uid}, 'ACTUALIZAR', 'PARAMETRO', ${JSON.stringify(dto)}::jsonb)`;
    });
    return this.servicio.obtenerDeEmpresa(u.codemp);
  }
}

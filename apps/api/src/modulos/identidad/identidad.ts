import { Body, Controller, ForbiddenException, Injectable, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { getAuth } from 'firebase-admin/auth';
import { normalizarCelularChile } from '@gm/domain';
import { Roles, UsuarioActual } from '../../comun/auth/roles.js';
import type { UsuarioAutenticado } from '../../comun/contexto.js';
import { PrismaService } from '../../comun/prisma.service.js';
import { Configuracion } from '../../configuracion.js';

export class EnrolarDispositivoDto {
  @IsString() @MaxLength(128) idinst: string;
  @IsOptional() @IsString() @MaxLength(80) modelo?: string;
  @IsOptional() @IsString() @MaxLength(40) so?: string;
}

/**
 * CU-01 Autenticar conductor y enrolar dispositivo.
 * La App obtiene el OTP por SMS directamente con Identity Platform; con el token resultante
 * (que contiene el número verificado) llama a este endpoint, que:
 *  1. verifica que el celular exista en CONDUCTOR y esté ACTIVO (flujo 3a);
 *  2. registra el dispositivo; revoca el anterior (decisión pendiente N° 9: reemplazo + aviso);
 *  3. fija los claims personalizados (perfil, codemp, rutcon, iddis) del usuario.
 */
@Injectable()
export class IdentidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: Configuracion,
  ) {}

  async enrolar(
    uid: string,
    telefonoVerificado: string,
    codemp: string,
    dto: EnrolarDispositivoDto,
  ) {
    const celcon = normalizarCelularChile(telefonoVerificado);
    if (!celcon) throw new ForbiddenException('Número no registrado. Contacte al Administrador.');

    const resultado = await this.prisma.enEmpresa(codemp, async (tx) => {
      const [c] = await tx.$queryRaw<{ rutcon: number; perfil: string | null }[]>`
        SELECT c.rutcon, u.perfil FROM conductor c LEFT JOIN usuario u ON u.idusr = c.idusr
        WHERE c.codemp = ${codemp} AND c.celcon = ${celcon} AND c.estcon = 'ACTIVO'`;
      if (!c) {
        await tx.$executeRaw`INSERT INTO auditoria (codemp, usuario, accion, entidad)
                             VALUES (${codemp}, ${uid}, 'ENROLAMIENTO_RECHAZADO', 'DISPOSITIVO')`;
        return null;
      }
      const revocados = await tx.$executeRaw`
        UPDATE dispositivo SET estado = 'REVOCADO'
        WHERE codemp = ${codemp} AND rutcon = ${c.rutcon} AND estado = 'ACTIVO'`;
      const [d] = await tx.$queryRaw<{ iddis: string }[]>`
        INSERT INTO dispositivo (codemp, rutcon, idinst, modelo, so)
        VALUES (${codemp}, ${c.rutcon}, ${dto.idinst}, ${dto.modelo ?? null}, ${dto.so ?? null})
        RETURNING iddis::text`;
      await tx.$executeRaw`INSERT INTO auditoria (codemp, usuario, accion, entidad, clave)
                           VALUES (${codemp}, ${uid}, 'ENROLAMIENTO', 'DISPOSITIVO', ${d!.iddis})`;
      return {
        rutcon: c.rutcon,
        iddis: d!.iddis,
        perfil: c.perfil ?? 'CONDUCTOR',
        reemplazo: revocados > 0,
      };
    });

    if (!resultado)
      throw new ForbiddenException('Número no registrado. Contacte al Administrador.');

    if (!this.config.authDevBypass) {
      await getAuth().setCustomUserClaims(uid, {
        perfil: resultado.perfil,
        codemp,
        rutcon: resultado.rutcon,
        iddis: resultado.iddis,
      });
    }
    return { ...resultado, renovarToken: true };
  }
}

@ApiTags('identidad')
@ApiBearerAuth()
@Controller('auth')
export class IdentidadController {
  constructor(private readonly servicio: IdentidadService) {}

  /** POST /v1/auth/dispositivos – CU-01 paso 6. */
  @Post('dispositivos')
  @Roles('CONDUCTOR', 'ADMINISTRADOR')
  async enrolar(@UsuarioActual() u: UsuarioAutenticado, @Body() dto: EnrolarDispositivoDto) {
    // El número viene verificado por OTP en el token (claim phone_number).
    if (!u.telefono) throw new ForbiddenException('El token no contiene un teléfono verificado.');
    return this.servicio.enrolar(u.uid, u.telefono, u.codemp, dto);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Roles, UsuarioActual } from '../../comun/auth/roles.js';
import type { UsuarioAutenticado } from '../../comun/contexto.js';
import { PrismaService } from '../../comun/prisma.service.js';
import { ImportacionService } from './importacion.service.js';

const MAX_BYTES = 5 * 1024 * 1024;

class CambiarEstadoDto {
  @IsIn(['ACTIVO', 'INACTIVO']) estado: 'ACTIVO' | 'INACTIVO';
}

const TABLAS = {
  centros: { tabla: 'centro', clave: 'codcen', estado: 'estcen' },
  laboratorios: { tabla: 'laboratorio', clave: 'codlab', estado: 'estlab' },
  conductores: { tabla: 'conductor', clave: 'rutcon', estado: 'estcon' },
} as const;
type Recurso = keyof typeof TABLAS;

/**
 * CU-05: importación y mantenedores. En el Piloto 1 los mantenedores ofrecen consulta y baja
 * lógica (RN-19); el alta y la edición masiva se realizan por importación validada.
 */
@ApiTags('maestros')
@ApiBearerAuth()
@Controller()
export class MaestrosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importacion: ImportacionService,
  ) {}

  @Post('importaciones')
  @Roles('ADMINISTRADOR')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES } }))
  validar(@UsuarioActual() u: UsuarioAutenticado, @UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Adjunte la planilla en el campo «archivo».');
    if (!/\.xlsx$/i.test(archivo.originalname))
      throw new BadRequestException('Solo se aceptan archivos .xlsx.');
    return this.importacion.validar(u, archivo.originalname, archivo.buffer);
  }

  @Post('importaciones/:id/confirmar')
  @Roles('ADMINISTRADOR')
  confirmar(@UsuarioActual() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.importacion.confirmar(u, id);
  }

  @Get('maestros/centros')
  @Roles('ADMINISTRADOR')
  centros(@UsuarioActual() u: UsuarioAutenticado) {
    return this.prisma.enEmpresa(
      u.codemp,
      (tx) => tx.$queryRaw`
      SELECT codcen, comcen, descen, alicen, latcen::float8, loncen::float8, radcen,
             lun, mar, mie, jue, vie, sab, dom, codlab, estcen
      FROM centro WHERE codemp = ${u.codemp} ORDER BY codcen`,
    );
  }

  @Get('maestros/laboratorios')
  @Roles('ADMINISTRADOR')
  laboratorios(@UsuarioActual() u: UsuarioAutenticado) {
    return this.prisma.enEmpresa(
      u.codemp,
      (tx) => tx.$queryRaw`
      SELECT codlab, comlab, deslab, alilab, latlab::float8, lonlab::float8, radlab, estlab
      FROM laboratorio WHERE codemp = ${u.codemp} ORDER BY codlab`,
    );
  }

  @Get('maestros/conductores')
  @Roles('ADMINISTRADOR')
  conductores(@UsuarioActual() u: UsuarioAutenticado) {
    return this.prisma.enEmpresa(
      u.codemp,
      (tx) => tx.$queryRaw`
      SELECT rutcon, dvecon, nomcon, priapecon, segapecon, alicon, celcon, emailcon, estcon
      FROM conductor WHERE codemp = ${u.codemp} ORDER BY priapecon, nomcon`,
    );
  }

  @Get('maestros/rutas')
  @Roles('ADMINISTRADOR')
  rutas(@UsuarioActual() u: UsuarioAutenticado) {
    return this.prisma.enEmpresa(
      u.codemp,
      (tx) => tx.$queryRaw`
      SELECT idrut, rutcon, codcen, to_char(horrut, 'HH24:MI') AS horrut, diasem, vigdes, vighas, estrut
      FROM ruta_conductor WHERE codemp = ${u.codemp} ORDER BY rutcon, horrut`,
    );
  }

  /** Baja o reactivación lógica (RN-19), con bitácora y auditoría. */
  @Patch('maestros/:recurso/:codigo/estado')
  @Roles('ADMINISTRADOR')
  async cambiarEstado(
    @UsuarioActual() u: UsuarioAutenticado,
    @Param('recurso') recurso: string,
    @Param('codigo', ParseIntPipe) codigo: number,
    @Body() dto: CambiarEstadoDto,
  ) {
    if (!(recurso in TABLAS)) throw new BadRequestException('Recurso no válido.');
    const t = TABLAS[recurso as Recurso];
    const usr = u.correo ?? u.uid;
    await this.prisma.enEmpresa(u.codemp, async (tx) => {
      // Nombres de tabla y columna provienen de la lista blanca TABLAS.
      const n = await tx.$executeRawUnsafe(
        `UPDATE ${t.tabla} SET ${t.estado} = $1, usract = $2, dateact = now() WHERE codemp = $3 AND ${t.clave} = $4`,
        dto.estado,
        usr,
        u.codemp,
        codigo,
      );
      if (n === 0) throw new BadRequestException('Registro no encontrado.');
      await tx.$executeRaw`INSERT INTO auditoria (codemp, usuario, accion, entidad, clave, valor_nue)
        VALUES (${u.codemp}, ${usr}, 'CAMBIAR_ESTADO', ${t.tabla}, ${String(codigo)}, ${JSON.stringify(dto)}::jsonb)`;
    });
    return { recurso, codigo, estado: dto.estado };
  }
}

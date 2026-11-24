import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiTags } from '@nestjs/swagger';
import { Roles, UsuarioActual } from '../../comun/auth/roles.js';
import type { UsuarioAutenticado } from '../../comun/contexto.js';
import { CrearMarcacionDto } from './marcacion.dto.js';
import { MarcacionesService } from './marcaciones.service.js';

@ApiTags('marcaciones')
@ApiBearerAuth()
@Controller('marcaciones')
export class MarcacionesController {
  constructor(private readonly servicio: MarcacionesService) {}

  /** CU-02. Idempotente por IDVIA: un reenvío devuelve 200 con `repetida = true`. */
  @Post()
  @HttpCode(200)
  @Roles('CONDUCTOR', 'ADMINISTRADOR')
  @ApiConflictResponse({
    description: 'POSIBLE_DUPLICADO (RN-07): reenviar con confirmarDuplicado = true',
  })
  registrar(@UsuarioActual() u: UsuarioAutenticado, @Body() dto: CrearMarcacionDto) {
    return this.servicio.registrar(u, dto);
  }

  @Get('hoy')
  @Roles('CONDUCTOR', 'ADMINISTRADOR')
  hoy(@UsuarioActual() u: UsuarioAutenticado) {
    return this.servicio.historialDelDia(u);
  }
}

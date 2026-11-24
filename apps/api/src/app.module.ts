import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AutenticacionGuard } from './comun/auth/autenticacion.guard.js';
import { Publico, RolesGuard } from './comun/auth/roles.js';
import { PrismaService } from './comun/prisma.service.js';
import { Configuracion } from './configuracion.js';
import { ConsultasController, ConsultasService } from './modulos/consultas/consultas.js';
import { GeovalidacionService } from './modulos/geovalidacion/geovalidacion.service.js';
import { IdentidadController, IdentidadService } from './modulos/identidad/identidad.js';
import { ImportacionService } from './modulos/maestros/importacion.service.js';
import { MaestrosController } from './modulos/maestros/maestros.controller.js';
import { MarcacionesController } from './modulos/marcaciones/marcaciones.controller.js';
import { MarcacionesService } from './modulos/marcaciones/marcaciones.service.js';
import {
  ParametrosController,
  ParametrosService,
} from './modulos/parametros/parametros.service.js';
import { PlanificacionService } from './modulos/planificacion/planificacion.service.js';

@Controller('salud')
class SaludController {
  constructor(private readonly config: Configuracion) {}

  @Get()
  @Publico()
  salud() {
    return {
      estado: 'OK',
      version: process.env['APP_VERSION'] ?? '0.1.0',
      versionMinimaApp: this.config.versionMinimaApp,
    };
  }
}

/** Infraestructura compartida (Configuración y acceso a datos). */
@Module({ providers: [Configuracion, PrismaService], exports: [Configuracion, PrismaService] })
class ModuloComun {}

@Module({
  imports: [ModuloComun],
  providers: [ParametrosService],
  controllers: [ParametrosController],
  exports: [ParametrosService],
})
class ModuloParametros {}

@Module({
  imports: [ModuloComun],
  providers: [PlanificacionService],
  exports: [PlanificacionService],
})
class ModuloPlanificacion {}

@Module({
  imports: [ModuloComun],
  providers: [IdentidadService],
  controllers: [IdentidadController],
})
class ModuloIdentidad {}

@Module({
  imports: [ModuloComun, ModuloParametros],
  providers: [GeovalidacionService, MarcacionesService],
  controllers: [MarcacionesController],
})
class ModuloMarcaciones {}

@Module({
  imports: [ModuloComun, ModuloParametros, ModuloPlanificacion],
  providers: [ConsultasService],
  controllers: [ConsultasController],
})
class ModuloConsultas {}

@Module({
  imports: [ModuloComun],
  providers: [ImportacionService],
  controllers: [MaestrosController],
})
class ModuloMaestros {}

/** API (Cloud Run Service). Guardas globales: autenticación y rol obligatorio por endpoint. */
@Module({
  imports: [
    ModuloComun,
    ModuloParametros,
    ModuloPlanificacion,
    ModuloIdentidad,
    ModuloMarcaciones,
    ModuloConsultas,
    ModuloMaestros,
  ],
  controllers: [SaludController],
  providers: [
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

/** Procesos programados (Cloud Run Jobs). */
@Module({ imports: [ModuloComun, ModuloPlanificacion] })
export class ModuloTrabajos {}

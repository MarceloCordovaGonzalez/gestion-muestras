/**
 * Cloud Run Job «planificacion-diaria» (Cloud Scheduler 00:05 America/Santiago).
 * Uso: node dist/jobs/planificacion-diaria.js [YYYY-MM-DD] [CODEMP]
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { fechaLocal } from '@gm/domain';
import { ModuloTrabajos } from '../app.module.js';
import { PlanificacionService } from '../modulos/planificacion/planificacion.service.js';

const fecha = process.argv[2] ?? fechaLocal(new Date());
const empresas = (process.argv[3] ?? process.env['EMPRESAS'] ?? 'EMP1').split(',');

const app = await NestFactory.createApplicationContext(ModuloTrabajos, {
  logger: ['log', 'error', 'warn'],
});
try {
  const servicio = app.get(PlanificacionService);
  for (const codemp of empresas) await servicio.generarDia(codemp, fecha);
} finally {
  await app.close();
}

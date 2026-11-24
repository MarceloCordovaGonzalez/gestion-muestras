import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { Configuracion } from './configuracion.js';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
const config = app.get(Configuracion);

app.use(helmet());
app.enableCors({ origin: config.origenesWeb, credentials: false });
app.setGlobalPrefix('v1'); // API versionada (Modelo de Arquitectura 9); /v2 convivirá como prefijo nuevo
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
);

// Identificador de correlación (observabilidad, Modelo 12). No se registran datos personales.
app.use((req: Request, res: Response, next: NextFunction) => {
  req.idCorrelacion = req.header('x-correlation-id') ?? randomUUID();
  res.setHeader('x-correlation-id', req.idCorrelacion);
  next();
});

if (!config.produccion) {
  const doc = new DocumentBuilder()
    .setTitle('API Gestión de Muestras')
    .setVersion(process.env['APP_VERSION'] ?? '0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('v1/docs', app, SwaggerModule.createDocument(app, doc));
}

app.enableShutdownHooks();
await app.listen(config.puerto);
new Logger('main').log(`API escuchando en el puerto ${config.puerto}`);

import { Injectable } from '@nestjs/common';
import { type IndicadoresFuncionalidad, resolverIndicadores } from '@gm/domain';

/** Configuración tipada desde variables de entorno (secretos vía Secret Manager en Cloud Run). */
@Injectable()
export class Configuracion {
  readonly puerto = Number(process.env['PORT'] ?? 8080);
  readonly produccion = process.env['NODE_ENV'] === 'production';
  readonly firebaseProjectId = process.env['FIREBASE_PROJECT_ID'] ?? 'gm-dev';
  readonly authDevBypass = !this.produccion && process.env['AUTH_DEV_BYPASS'] === 'true';
  /** Empresa usada en el primer enrolamiento (Piloto 1: EMP1). */
  readonly codempEnrolamiento = process.env['CODEMP_ENROLAMIENTO'] ?? 'EMP1';
  readonly origenesWeb = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173').split(',');
  /** Versión mínima de la App aceptada (actualización forzada, Modelo 12). */
  readonly versionMinimaApp = process.env['APP_VERSION_MINIMA'] ?? '0.1.0';

  /** Valores por defecto de los indicadores; la tabla PARAMETRO los sobrescribe por empresa. */
  indicadoresEntorno(): IndicadoresFuncionalidad {
    return resolverIndicadores(process.env);
  }
}

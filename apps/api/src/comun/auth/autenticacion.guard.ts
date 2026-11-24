import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Configuracion } from '../../configuracion.js';
import type { Perfil, UsuarioAutenticado } from '../contexto.js';
import { CLAVE_PUBLICO } from './roles.js';

/**
 * Verifica el JWT de Google Identity Platform (OTP por SMS para quien marca; correo + MFA para
 * el Administrador web). Los claims personalizados `perfil`, `codemp`, `rutcon` e `iddis` se
 * asignan en el enrolamiento (CU-01) o al crear el usuario (CU-09).
 *
 * En desarrollo local (AUTH_DEV_BYPASS=true y NODE_ENV != production) acepta
 * `Bearer dev:<PERFIL>:<CODEMP>:<rutcon>:<iddis>`.
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  private readonly log = new Logger(AutenticacionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: Configuracion,
  ) {
    if (getApps().length === 0) initializeApp({ projectId: config.firebaseProjectId });
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [ctx.getHandler(), ctx.getClass()])
    ) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException('Falta el token de acceso.');

    req.usuario =
      this.config.authDevBypass && token.startsWith('dev:')
        ? this.desdeTokenDesarrollo(token)
        : await this.desdeIdentityPlatform(token);
    return true;
  }

  private async desdeIdentityPlatform(token: string): Promise<UsuarioAutenticado> {
    try {
      const d = await getAuth().verifyIdToken(token, true);
      const perfil = d['perfil'] as Perfil | undefined;
      const codemp = d['codemp'] as string | undefined;
      const telefono = d.phone_number ?? null;
      if (!perfil || !codemp) {
        // Primer ingreso tras el OTP: solo puede enrolarse (CU-01). El Piloto 1 opera con una
        // empresa; con más empresas, el enrolamiento resolverá CODEMP por el celular.
        if (!telefono) throw new Error('Token sin perfil, empresa ni teléfono verificado');
        return {
          uid: d.uid,
          perfil: 'CONDUCTOR',
          codemp: this.config.codempEnrolamiento,
          rutcon: null,
          iddis: null,
          correo: null,
          telefono,
          enrolamientoPendiente: true,
        };
      }
      return {
        uid: d.uid,
        perfil,
        codemp,
        rutcon: typeof d['rutcon'] === 'number' ? (d['rutcon'] as number) : null,
        iddis: (d['iddis'] as string | undefined) ?? null,
        correo: d.email ?? null,
        telefono,
        enrolamientoPendiente: false,
      };
    } catch (e) {
      this.log.warn(`Token rechazado: ${(e as Error).message}`);
      throw new UnauthorizedException('Token inválido o revocado.');
    }
  }

  /** `dev:<PERFIL>:<CODEMP>:<rutcon>:<iddis>:<telefono>`; campos vacíos = null. */
  private desdeTokenDesarrollo(token: string): UsuarioAutenticado {
    const [, perfil, codemp, rutcon, iddis, telefono] = token.split(':');
    if (perfil !== 'CONDUCTOR' && perfil !== 'ADMINISTRADOR') throw new UnauthorizedException();
    return {
      uid: `dev-${perfil}-${rutcon || telefono || '0'}`,
      perfil,
      codemp: codemp || 'EMP1',
      rutcon: rutcon ? Number(rutcon) : null,
      iddis: iddis || null,
      correo: null,
      telefono: telefono || null,
      enrolamientoPendiente: !rutcon,
    };
  }
}

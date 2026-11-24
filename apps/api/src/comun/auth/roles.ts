import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Perfil, UsuarioAutenticado } from '../contexto.js';

export const CLAVE_ROLES = 'roles';
export const CLAVE_PUBLICO = 'publico';

/** Declara los perfiles autorizados (cu v1.1: CONDUCTOR y ADMINISTRADOR). Obligatorio. */
export const Roles = (...perfiles: Perfil[]) => SetMetadata(CLAVE_ROLES, perfiles);

/** Marca un endpoint como público (solo /v1/salud). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.usuario) throw new ForbiddenException();
    return req.usuario;
  },
);

/**
 * Autorización por rol en cada endpoint (Modelo de Arquitectura 11.2: escalamiento de
 * privilegios). Un endpoint sin @Roles ni @Publico se rechaza por defecto.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos)) return true;
    const perfiles = this.reflector.getAllAndOverride<Perfil[]>(CLAVE_ROLES, objetivos);
    const usuario = ctx.switchToHttp().getRequest<Request>().usuario;
    if (!perfiles || perfiles.length === 0 || !usuario) throw new ForbiddenException();
    if (!perfiles.includes(usuario.perfil)) throw new ForbiddenException('Perfil no autorizado.');
    return true;
  }
}

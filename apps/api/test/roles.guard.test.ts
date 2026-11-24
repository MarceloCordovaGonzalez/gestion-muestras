import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_PUBLICO, CLAVE_ROLES, RolesGuard } from '../src/comun/auth/roles.js';
import type { Perfil } from '../src/comun/contexto.js';

/** Modelo de Arquitectura 11.2: un conductor no puede invocar servicios de administración. */
function contexto(perfil: Perfil | null, metadatos: Record<string, unknown>): ExecutionContext {
  const handler = () => undefined;
  for (const [k, v] of Object.entries(metadatos)) Reflect.defineMetadata(k, v, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ usuario: perfil ? { perfil, codemp: 'EMP1' } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('CONDUCTOR no accede a un endpoint de ADMINISTRADOR', () => {
    assert.throws(
      () => guard.canActivate(contexto('CONDUCTOR', { [CLAVE_ROLES]: ['ADMINISTRADOR'] })),
      ForbiddenException,
    );
  });
  it('ADMINISTRADOR accede a la marcación (cu v1.1)', () => {
    assert.equal(
      guard.canActivate(
        contexto('ADMINISTRADOR', { [CLAVE_ROLES]: ['CONDUCTOR', 'ADMINISTRADOR'] }),
      ),
      true,
    );
  });
  it('un endpoint sin @Roles se rechaza por defecto', () => {
    assert.throws(() => guard.canActivate(contexto('ADMINISTRADOR', {})), ForbiddenException);
  });
  it('un endpoint @Publico no exige usuario', () => {
    assert.equal(guard.canActivate(contexto(null, { [CLAVE_PUBLICO]: true })), true);
  });
});

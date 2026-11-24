import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Ejecuta `trabajo` en una transacción con la empresa fijada para la seguridad por fila
   * (`SET LOCAL app.codemp`). Toda consulta de negocio debe pasar por aquí.
   */
  async enEmpresa<T>(codemp: string, trabajo: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.codemp', ${codemp}, true)`;
      return trabajo(tx);
    });
  }
}

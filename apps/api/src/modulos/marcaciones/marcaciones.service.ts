import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  buscarDuplicado,
  type Centro,
  detectarEntregaEnLaboratorioDistinto,
  type DiaSemana,
  evaluarFueraDeRuta,
  fechaLocal,
  horaLocal,
  type RutaConductor,
  type Viaje,
} from '@gm/domain';
import type { UsuarioAutenticado } from '../../comun/contexto.js';
import { PrismaService, type Tx } from '../../comun/prisma.service.js';
import { GeovalidacionService } from '../geovalidacion/geovalidacion.service.js';
import { ParametrosService } from '../parametros/parametros.service.js';
import type { ConfirmacionMarcacion, CrearMarcacionDto } from './marcacion.dto.js';

const DESFASE_MAX_MS = 10 * 60_000; // RN-06
const ERRORES_SOSPECHOSOS = 3; // CU-07: ≥ 3 errores del mismo conductor en el día

interface FilaViaje {
  idvia: string;
  rutcon: number;
  datevia: Date;
  tipvia: 'R' | 'E' | null;
  estvia: 'CORRECTO' | 'ERROR';
  codcen: number | null;
  codlab: number | null;
  comuna: string;
  fueraruta: 'S' | 'N';
  distancia: number | null;
  moterr: string | null;
}

/**
 * CU-02 Marcar retiro o entrega con geolocalización.
 * Geovalidación, comuna, fuera de ruta y persistencia ocurren en una sola transacción.
 */
@Injectable()
export class MarcacionesService {
  private readonly log = new Logger(MarcacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeovalidacionService,
    private readonly parametros: ParametrosService,
  ) {}

  async registrar(u: UsuarioAutenticado, dto: CrearMarcacionDto): Promise<ConfirmacionMarcacion> {
    if (u.rutcon === null || u.iddis === null) {
      // RN-23: el Administrador que marca debe estar registrado en CONDUCTOR y enrolado.
      throw new ForbiddenException(
        'Debe estar registrado como conductor y con dispositivo enrolado.',
      );
    }
    const rutcon = u.rutcon;
    const iddis = u.iddis;

    return this.prisma.enEmpresa(u.codemp, async (tx) => {
      // Idempotencia (RNF-03): un reenvío devuelve la misma confirmación.
      const previa = await this.buscarPorId(tx, dto.idvia);
      if (previa) return this.aConfirmacion(tx, u.codemp, previa, true);

      const conductor = await this.validarConductorYDispositivo(tx, u.codemp, rutcon, iddis);
      const params = await this.parametros.obtener(tx, u.codemp);
      const fecha = fechaLocal(dto.datevia);

      const g = await this.geo.clasificar(tx, u.codemp, dto.lat, dto.lon, params.radioDefectoM);

      // RN-07 (MEJ-07, activa): posible duplicado → pedir confirmación al conductor.
      let duplicadoConfirmado = false;
      if (params.indicadores.deduplicacion && g.estvia === 'CORRECTO') {
        const delDia = await this.viajesDelDia(tx, u.codemp, rutcon, fecha);
        const dup = buscarDuplicado(
          { rutcon, datevia: dto.datevia, tipvia: g.tipvia, codcen: g.codcen, codlab: g.codlab },
          delDia.map(aViajeDominio),
          params.ventanaDedupMin,
        );
        if (dup && !dto.confirmarDuplicado) {
          throw new ConflictException({
            codigo: 'POSIBLE_DUPLICADO',
            mensaje:
              'Ya registró una marcación en este punto hace menos de ' +
              `${params.ventanaDedupMin} minutos. ¿Desea registrarla de todos modos?`,
            idviaPrevio: dup.idvia,
          });
        }
        duplicadoConfirmado = dup !== null;
      }

      // RN-21: fuera de ruta (nunca se rechaza, ADR-11).
      let fueraruta: 'S' | 'N' = 'N';
      let idpla: string | null = null;
      if (g.tipvia === 'R' && g.codcen !== null) {
        const [centro, rutas] = await Promise.all([
          this.centro(tx, u.codemp, g.codcen),
          this.rutasDelConductor(tx, u.codemp, rutcon, g.codcen),
        ]);
        fueraruta = evaluarFueraDeRuta(
          { tipvia: g.tipvia, estvia: g.estvia, codcen: g.codcen, rutcon, fecha },
          rutas,
          centro ? [centro] : [],
        );
        if (fueraruta === 'N')
          idpla = await this.retiroPlanificado(tx, u.codemp, rutcon, g.codcen, fecha, dto.datevia);
      }

      const desfase = Math.abs(Date.now() - new Date(dto.datevia).getTime());
      const revisarDesfase = dto.origen === 'EN_LINEA' && desfase > DESFASE_MAX_MS;

      await tx.$executeRaw`
        INSERT INTO viaje (idvia, codemp, datevia, rutcon, celcon, tipvia, comuna, codcen, codlab,
                           latvia, lonvia, estvia, fueraruta, precision, distancia, moterr, idpla,
                           iddis, origen, duplicado_confirmado, revisar_desfase, app_version)
        VALUES (${dto.idvia}::uuid, ${u.codemp}, ${dto.datevia}::timestamptz, ${rutcon},
                ${conductor.celcon}, ${g.tipvia}, ${g.comuna}, ${g.codcen}, ${g.codlab},
                ${dto.lat}, ${dto.lon}, ${g.estvia}, ${fueraruta}, ${dto.precision}, ${g.distancia},
                ${g.moterr}, ${idpla}::uuid, ${iddis}::uuid, ${dto.origen}, ${duplicadoConfirmado},
                ${revisarDesfase}, ${dto.appVersion ?? null})`;

      if (idpla) {
        await tx.$executeRaw`UPDATE retiro_planificado SET idvia = ${dto.idvia}::uuid WHERE idpla = ${idpla}::uuid`;
      }
      await tx.$executeRaw`UPDATE dispositivo SET ultuso = now() WHERE iddis = ${iddis}::uuid`;

      await this.generarAvisos(
        tx,
        u.codemp,
        rutcon,
        fecha,
        dto,
        g.estvia,
        fueraruta,
        params.indicadores.pendientesEntrega,
      );

      const creada = (await this.buscarPorId(tx, dto.idvia))!;
      return this.aConfirmacion(tx, u.codemp, creada, false);
    });
  }

  /** Historial del día de quien marca (GET /v1/marcaciones/hoy). */
  async historialDelDia(u: UsuarioAutenticado): Promise<ConfirmacionMarcacion[]> {
    if (u.rutcon === null) return [];
    const rutcon = u.rutcon;
    return this.prisma.enEmpresa(u.codemp, async (tx) => {
      const filas = await this.viajesDelDia(tx, u.codemp, rutcon, fechaLocal(new Date()));
      return Promise.all(filas.map((f) => this.aConfirmacion(tx, u.codemp, f, false)));
    });
  }

  // ---------------------------------------------------------------------------

  private async generarAvisos(
    tx: Tx,
    codemp: string,
    rutcon: number,
    fecha: string,
    dto: CrearMarcacionDto,
    estvia: 'CORRECTO' | 'ERROR',
    fueraruta: 'S' | 'N',
    pendientesActivo: boolean,
  ): Promise<void> {
    if (fueraruta === 'S') {
      await this.aviso(tx, codemp, fecha, 'RETIRO_FUERA_DE_RUTA', dto.idvia, rutcon, {});
    }
    if (estvia === 'ERROR') {
      const [{ n }] = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM viaje
        WHERE codemp = ${codemp} AND rutcon = ${rutcon} AND fecvia = ${fecha}::date AND estvia = 'ERROR'`;
      if (n === ERRORES_SOSPECHOSOS) {
        await this.aviso(tx, codemp, fecha, 'MARCACION_SOSPECHOSA', dto.idvia, rutcon, {
          errores: n,
        });
      }
    }
    // RN-16 / MEJ-18: desactivado en el Piloto 1 (indicador pendientesEntrega = false).
    if (pendientesActivo) {
      const delDia = (await this.viajesDelDia(tx, codemp, rutcon, fecha)).map(aViajeDominio);
      const entrega = delDia.find((v) => v.idvia === dto.idvia);
      const centros = await this.centrosDeViajes(tx, codemp, delDia);
      const r = entrega ? detectarEntregaEnLaboratorioDistinto(entrega, delDia, centros) : null;
      if (r) await this.aviso(tx, codemp, fecha, 'ENTREGA_LAB_DISTINTO', dto.idvia, rutcon, r);
    }
  }

  private aviso(
    tx: Tx,
    codemp: string,
    fecha: string,
    tipo: string,
    idvia: string,
    rutcon: number,
    detalle: object,
  ) {
    return tx.$executeRaw`
      INSERT INTO aviso (codemp, fecavi, tipo, idvia, rutcon, detalle)
      VALUES (${codemp}, ${fecha}::date, ${tipo}, ${idvia}::uuid, ${rutcon}, ${JSON.stringify(detalle)}::jsonb)`;
  }

  private async validarConductorYDispositivo(
    tx: Tx,
    codemp: string,
    rutcon: number,
    iddis: string,
  ) {
    const [c] = await tx.$queryRaw<{ celcon: string; disp_activo: boolean }[]>`
      SELECT c.celcon,
             EXISTS (SELECT 1 FROM dispositivo d WHERE d.iddis = ${iddis}::uuid AND d.rutcon = c.rutcon
                     AND d.estado = 'ACTIVO') AS disp_activo
      FROM conductor c WHERE c.codemp = ${codemp} AND c.rutcon = ${rutcon} AND c.estcon = 'ACTIVO'`;
    // Flujo 3a del CU-02.
    if (!c)
      throw new ForbiddenException(
        'Número no registrado o conductor inactivo. Contacte al Administrador.',
      );
    if (!c.disp_activo)
      throw new ForbiddenException('Dispositivo revocado. Debe enrolarse nuevamente.');
    return c;
  }

  private async buscarPorId(tx: Tx, idvia: string): Promise<FilaViaje | null> {
    const [f] = await tx.$queryRaw<FilaViaje[]>`
      SELECT idvia, rutcon, datevia, tipvia, estvia, codcen, codlab, comuna, fueraruta, distancia, moterr
      FROM viaje WHERE idvia = ${idvia}::uuid`;
    return f ?? null;
  }

  private viajesDelDia(tx: Tx, codemp: string, rutcon: number, fecha: string) {
    return tx.$queryRaw<FilaViaje[]>`
      SELECT idvia, rutcon, datevia, tipvia, estvia, codcen, codlab, comuna, fueraruta, distancia, moterr
      FROM viaje WHERE codemp = ${codemp} AND rutcon = ${rutcon} AND fecvia = ${fecha}::date
      ORDER BY datevia`;
  }

  private async centro(tx: Tx, codemp: string, codcen: number): Promise<Centro | undefined> {
    const [c] = await tx.$queryRaw<FilaCentro[]>`
      SELECT codcen, comcen, alicen, radcen, codlab, estcen, latcen::float8 AS lat, loncen::float8 AS lon,
             lun, mar, mie, jue, vie, sab, dom
      FROM centro WHERE codemp = ${codemp} AND codcen = ${codcen}`;
    return c ? aCentro(c) : undefined;
  }

  private async centrosDeViajes(tx: Tx, codemp: string, viajes: Viaje[]): Promise<Centro[]> {
    const codigos = [
      ...new Set(viajes.map((v) => v.codcen).filter((c): c is number => c !== null)),
    ];
    if (codigos.length === 0) return [];
    const filas = await tx.$queryRaw<FilaCentro[]>`
      SELECT codcen, comcen, alicen, radcen, codlab, estcen, latcen::float8 AS lat, loncen::float8 AS lon,
             lun, mar, mie, jue, vie, sab, dom
      FROM centro WHERE codemp = ${codemp} AND codcen = ANY(${codigos}::int[])`;
    return filas.map(aCentro);
  }

  private async rutasDelConductor(
    tx: Tx,
    codemp: string,
    rutcon: number,
    codcen: number,
  ): Promise<RutaConductor[]> {
    const filas = await tx.$queryRaw<FilaRuta[]>`
      SELECT idrut::text, rutcon, codcen, to_char(horrut, 'HH24:MI:SS') AS horrut, diasem,
             to_char(vigdes, 'YYYY-MM-DD') AS vigdes, to_char(vighas, 'YYYY-MM-DD') AS vighas, estrut
      FROM ruta_conductor WHERE codemp = ${codemp} AND rutcon = ${rutcon} AND codcen = ${codcen}`;
    return filas.map((r) => ({ ...r, diasem: (r.diasem as DiaSemana | null) ?? null }));
  }

  /** Asocia el retiro al planificado pendiente del mismo conductor y centro con hora más cercana. */
  private async retiroPlanificado(
    tx: Tx,
    codemp: string,
    rutcon: number,
    codcen: number,
    fecha: string,
    datevia: string,
  ) {
    const hora = horaLocal(datevia);
    const [p] = await tx.$queryRaw<{ idpla: string }[]>`
      SELECT idpla::text FROM retiro_planificado
      WHERE codemp = ${codemp} AND fecpla = ${fecha}::date AND rutcon = ${rutcon} AND codcen = ${codcen}
        AND idvia IS NULL
      ORDER BY abs(extract(epoch FROM (horpla - ${hora}::time))) LIMIT 1`;
    return p?.idpla ?? null;
  }

  private async aConfirmacion(
    tx: Tx,
    codemp: string,
    v: FilaViaje,
    repetida: boolean,
  ): Promise<ConfirmacionMarcacion> {
    const [punto] =
      v.tipvia === 'R'
        ? await tx.$queryRaw<
            { alias: string }[]
          >`SELECT alicen AS alias FROM centro WHERE codemp = ${codemp} AND codcen = ${v.codcen}`
        : v.tipvia === 'E'
          ? await tx.$queryRaw<
              { alias: string }[]
            >`SELECT alilab AS alias FROM laboratorio WHERE codemp = ${codemp} AND codlab = ${v.codlab}`
          : [];
    return {
      idvia: v.idvia,
      fecha: fechaLocal(v.datevia),
      hora: horaLocal(v.datevia),
      tipvia: v.tipvia,
      estvia: v.estvia,
      punto: v.tipvia
        ? {
            tipo: v.tipvia === 'R' ? 'CENTRO' : 'LABORATORIO',
            codigo: (v.codcen ?? v.codlab)!,
            alias: punto?.alias ?? '',
          }
        : null,
      comuna: v.comuna,
      fueraDeRuta: v.fueraruta === 'S',
      distancia: v.distancia,
      moterr: v.moterr,
      puntoMasCercano: null,
      repetida,
    };
  }
}

interface FilaCentro {
  codcen: number;
  comcen: string;
  alicen: string;
  radcen: number | null;
  codlab: number;
  estcen: 'ACTIVO' | 'INACTIVO';
  lat: number;
  lon: number;
  lun: 'S' | 'N';
  mar: 'S' | 'N';
  mie: 'S' | 'N';
  jue: 'S' | 'N';
  vie: 'S' | 'N';
  sab: 'S' | 'N';
  dom: 'S' | 'N';
}

interface FilaRuta {
  idrut: string;
  rutcon: number;
  codcen: number;
  horrut: string;
  diasem: number | null;
  vigdes: string | null;
  vighas: string | null;
  estrut: 'ACTIVO' | 'INACTIVO';
}

export const aCentro = (c: FilaCentro): Centro => ({
  codcen: c.codcen,
  comcen: c.comcen,
  alicen: c.alicen,
  radcen: c.radcen,
  codlab: c.codlab,
  estcen: c.estcen,
  lat: c.lat,
  lon: c.lon,
  dias: { 1: c.lun, 2: c.mar, 3: c.mie, 4: c.jue, 5: c.vie, 6: c.sab, 7: c.dom },
});

const aViajeDominio = (f: FilaViaje): Viaje => ({
  idvia: f.idvia,
  rutcon: f.rutcon,
  datevia: f.datevia.toISOString(),
  tipvia: f.tipvia,
  estvia: f.estvia,
  codcen: f.codcen,
  codlab: f.codlab,
  comuna: f.comuna,
  fueraruta: f.fueraruta,
});

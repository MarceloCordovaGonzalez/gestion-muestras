import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  calcularDigitoVerificador,
  clasificarHojas,
  distanciaMetros,
  esCoordenadaChileContinental,
  type HojaImportable,
  normalizarCelularChile,
  normalizarEncabezado,
  normalizarHora,
  normalizarSN,
  vacioANull,
  validarEncabezados,
} from '@gm/domain';
import type { UsuarioAutenticado } from '../../comun/contexto.js';
import { PrismaService, type Tx } from '../../comun/prisma.service.js';

type Fila = Record<string, unknown>;

export interface ErrorFila {
  hoja: string;
  fila: number | null;
  columna?: string;
  mensaje: string;
}

export interface ResumenImportacion {
  idimp: string;
  hojasImportadas: HojaImportable[];
  hojasIgnoradas: string[];
  avisos: string[];
  errores: ErrorFila[];
  conteo: Record<string, number>;
  geocercasSolapadas: { codcenA: number; codcenB: number; distancia: number }[];
}

interface Datos {
  CENTRO: Fila[];
  LABORATORIO: Fila[];
  CONDUCTOR: Fila[];
  'RUTA CONDUCTOR': Fila[];
}

/**
 * CU-05: importación validada de MODELO_DATOS_MUESTRAS (RF-16 con reparo: la hoja VIAJE se
 * ignora; la lista Viaje se inicializa vacía en producción). Dos pasos: validar → confirmar.
 */
@Injectable()
export class ImportacionService {
  constructor(private readonly prisma: PrismaService) {}

  async validar(
    u: UsuarioAutenticado,
    nombreArchivo: string,
    contenido: Buffer,
  ): Promise<ResumenImportacion> {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(contenido as unknown as ArrayBuffer);
    const hojas = clasificarHojas(libro.worksheets.map((w) => w.name));
    const errores: ErrorFila[] = [];
    const avisos: string[] = [];

    if (hojas.ignoradas.includes('VIAJE')) {
      avisos.push('La hoja VIAJE no se importa: la lista Viaje se inicializa vacía (RF-16).');
    }
    const faltantes = (['CENTRO', 'LABORATORIO', 'CONDUCTOR', 'RUTA CONDUCTOR'] as const).filter(
      (h) => !hojas.importables.includes(h),
    );
    for (const h of faltantes)
      errores.push({ hoja: h, fila: null, mensaje: `Falta la hoja ${h}.` });

    const datos: Datos = { CENTRO: [], LABORATORIO: [], CONDUCTOR: [], 'RUTA CONDUCTOR': [] };
    for (const hoja of hojas.importables) {
      const ws = libro.worksheets.find((w) => w.name.trim().toUpperCase() === hoja)!;
      const encabezados = (ws.getRow(1).values as unknown[]).slice(1);
      const errEnc = validarEncabezados(hoja, encabezados);
      errores.push(...errEnc.map((e) => ({ hoja, fila: 1, mensaje: e.mensaje })));
      if (errEnc.length > 0) continue; // HAL-18: no se procesa una hoja con encabezados inválidos
      const nombres = encabezados.map(normalizarEncabezado);
      ws.eachRow((row, n) => {
        if (n === 1) return;
        const valores = (row.values as unknown[]).slice(1);
        if (valores.every((v) => vacioANull(v) === null)) return;
        const fila: Fila = { __fila: n };
        nombres.forEach((k, i) => (fila[k] = vacioANull(celda(valores[i]))));
        datos[hoja].push(fila);
      });
    }

    const comunas = await this.prisma.enEmpresa(
      u.codemp,
      (tx) => tx.$queryRaw<{ nomcom: string }[]>`SELECT nomcom FROM comuna`,
    );
    const catalogo = new Set(comunas.map((c) => c.nomcom));
    const solapadas = this.validarDatos(u.codemp, datos, catalogo, errores);

    const resumen = {
      hojasImportadas: hojas.importables,
      hojasIgnoradas: hojas.ignoradas,
      avisos,
      errores,
      conteo: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v.length])),
      geocercasSolapadas: solapadas,
    };
    const [r] = await this.prisma.enEmpresa(
      u.codemp,
      (tx) => tx.$queryRaw<{ idimp: string }[]>`
      INSERT INTO importacion (codemp, archivo, estado, resumen, usrcre)
      VALUES (${u.codemp}, ${nombreArchivo}, ${errores.length ? 'CON_ERRORES' : 'VALIDADA'},
              ${JSON.stringify({ ...resumen, datos })}::jsonb, ${u.correo ?? u.uid})
      RETURNING idimp::text`,
    );
    return { idimp: r!.idimp, ...resumen };
  }

  /** Aplica de forma transaccional una importación VALIDADA (paso 4 del CU-05). */
  async confirmar(u: UsuarioAutenticado, idimp: string) {
    return this.prisma.enEmpresa(u.codemp, async (tx) => {
      const [imp] = await tx.$queryRaw<{ estado: string; resumen: { datos: Datos } }[]>`
        SELECT estado, resumen FROM importacion WHERE idimp = ${idimp}::uuid FOR UPDATE`;
      if (!imp) throw new NotFoundException('Importación no encontrada.');
      if (imp.estado !== 'VALIDADA')
        throw new BadRequestException(`La importación está ${imp.estado}.`);
      const usr = u.correo ?? u.uid;
      const d = imp.resumen.datos;
      for (const l of d.LABORATORIO) await this.upsertLaboratorio(tx, u.codemp, l, usr);
      for (const c of d.CENTRO) await this.upsertCentro(tx, u.codemp, c, usr);
      for (const c of d.CONDUCTOR) await this.upsertConductor(tx, u.codemp, c, usr);
      for (const r of d['RUTA CONDUCTOR']) await this.upsertRuta(tx, u.codemp, r, usr);
      await tx.$executeRaw`UPDATE importacion SET estado = 'APLICADA', dateapl = now() WHERE idimp = ${idimp}::uuid`;
      await tx.$executeRaw`INSERT INTO auditoria (codemp, usuario, accion, entidad, clave)
                           VALUES (${u.codemp}, ${usr}, 'APLICAR', 'IMPORTACION', ${idimp})`;
      return { idimp, estado: 'APLICADA' };
    });
  }

  // ---------------------------------------------------------------------------

  private validarDatos(codemp: string, d: Datos, comunas: Set<string>, errores: ErrorFila[]) {
    const err = (hoja: string, f: Fila, mensaje: string) =>
      errores.push({ hoja, fila: Number(f['__fila']), mensaje });
    const empresa = (hoja: string, f: Fila) => {
      if (f['CODEMP'] !== codemp)
        err(hoja, f, `CODEMP «${String(f['CODEMP'])}» no corresponde a la empresa ${codemp}.`);
    };
    const coord = (hoja: string, f: Fila, lat: string, lon: string) => {
      if (!esCoordenadaChileContinental({ lat: Number(f[lat]), lon: Number(f[lon]) })) {
        err(
          hoja,
          f,
          `Coordenadas fuera de Chile continental (${String(f[lat])}, ${String(f[lon])}).`,
        );
      }
    };

    const labs = new Set<number>();
    for (const l of d.LABORATORIO) {
      empresa('LABORATORIO', l);
      coord('LABORATORIO', l, 'LATLAB', 'LONLAB');
      if (!comunas.has(String(l['COMLAB']).toUpperCase()))
        err('LABORATORIO', l, `Comuna «${String(l['COMLAB'])}» no existe en el catálogo.`);
      if (labs.has(Number(l['CODLAB'])))
        err('LABORATORIO', l, `CODLAB ${String(l['CODLAB'])} duplicado.`);
      labs.add(Number(l['CODLAB']));
    }
    const centros = new Set<number>();
    for (const c of d.CENTRO) {
      empresa('CENTRO', c);
      coord('CENTRO', c, 'LATCEN', 'LONCEN');
      if (!comunas.has(String(c['COMCEN']).toUpperCase()))
        err('CENTRO', c, `Comuna «${String(c['COMCEN'])}» no existe en el catálogo.`);
      if (!labs.has(Number(c['CODLAB'])))
        err('CENTRO', c, `Laboratorio de destino ${String(c['CODLAB'])} no existe.`);
      for (const dia of ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']) {
        if (!normalizarSN(c[dia])) err('CENTRO', c, `${dia} debe ser S o N.`);
      }
      if (centros.has(Number(c['CODCEN'])))
        err('CENTRO', c, `CODCEN ${String(c['CODCEN'])} duplicado.`);
      centros.add(Number(c['CODCEN']));
    }
    const celulares = new Set<string>();
    const ruts = new Set<number>();
    for (const c of d.CONDUCTOR) {
      empresa('CONDUCTOR', c);
      const rut = Number(c['RUTCON']);
      try {
        if (calcularDigitoVerificador(rut) !== String(c['DVECON']).toUpperCase())
          err('CONDUCTOR', c, `RUT ${rut} con dígito verificador inválido.`);
      } catch {
        err('CONDUCTOR', c, `RUT «${String(c['RUTCON'])}» inválido.`);
      }
      if (rut < 1_000_000) err('CONDUCTOR', c, `RUT ${rut} parece de prueba (HAL-10).`);
      const cel = normalizarCelularChile(String(c['CELCON'] ?? ''));
      if (!cel) err('CONDUCTOR', c, `Celular «${String(c['CELCON'])}» inválido.`);
      else if (celulares.has(cel)) err('CONDUCTOR', c, `Celular ${cel} duplicado (RN-01).`);
      else celulares.add(cel);
      ruts.add(rut);
    }
    for (const r of d['RUTA CONDUCTOR']) {
      empresa('RUTA CONDUCTOR', r);
      if (!ruts.has(Number(r['RUTCON'])))
        err('RUTA CONDUCTOR', r, `Conductor ${String(r['RUTCON'])} no existe.`);
      if (!centros.has(Number(r['CODCEN'])))
        err('RUTA CONDUCTOR', r, `Centro ${String(r['CODCEN'])} no existe.`);
      if (!normalizarHora(r['HORRUT']))
        err('RUTA CONDUCTOR', r, `HORRUT «${String(r['HORRUT'])}» inválida.`);
    }

    // Advertencia de geocercas solapadas (p. ej., centros 10 y 15).
    const solapadas: { codcenA: number; codcenB: number; distancia: number }[] = [];
    for (let i = 0; i < d.CENTRO.length; i++) {
      for (let j = i + 1; j < d.CENTRO.length; j++) {
        const a = d.CENTRO[i]!;
        const b = d.CENTRO[j]!;
        const dist = distanciaMetros(
          { lat: Number(a['LATCEN']), lon: Number(a['LONCEN']) },
          { lat: Number(b['LATCEN']), lon: Number(b['LONCEN']) },
        );
        if (dist < Number(a['RADCEN'] ?? 100) + Number(b['RADCEN'] ?? 100)) {
          solapadas.push({
            codcenA: Number(a['CODCEN']),
            codcenB: Number(b['CODCEN']),
            distancia: Math.round(dist),
          });
        }
      }
    }
    return solapadas;
  }

  private upsertLaboratorio(tx: Tx, codemp: string, l: Fila, usr: string) {
    return tx.$executeRaw`
      INSERT INTO laboratorio (codemp, codlab, comlab, deslab, alilab, dirlab, latlab, lonlab, radlab, usrcre)
      VALUES (${codemp}, ${Number(l['CODLAB'])}, ${String(l['COMLAB']).toUpperCase()}, ${String(l['DESLAB'])},
              ${String(l['ALILAB'])}, ${l['DIRLAB'] as string | null}, ${Number(l['LATLAB'])}, ${Number(l['LONLAB'])},
              ${l['RADLAB'] === null ? null : Number(l['RADLAB'])}, ${usr})
      ON CONFLICT (codemp, codlab) DO UPDATE SET comlab = EXCLUDED.comlab, deslab = EXCLUDED.deslab,
        alilab = EXCLUDED.alilab, dirlab = EXCLUDED.dirlab, latlab = EXCLUDED.latlab, lonlab = EXCLUDED.lonlab,
        radlab = EXCLUDED.radlab, usract = ${usr}, dateact = now()`;
  }

  private upsertCentro(tx: Tx, codemp: string, c: Fila, usr: string) {
    const sn = (k: string) => normalizarSN(c[k]);
    return tx.$executeRaw`
      INSERT INTO centro (codemp, codcen, comcen, descen, alicen, dircen, latcen, loncen, radcen,
                          lun, mar, mie, jue, vie, sab, dom, codlab, usrcre)
      VALUES (${codemp}, ${Number(c['CODCEN'])}, ${String(c['COMCEN']).toUpperCase()}, ${String(c['DESCEN'])},
              ${String(c['ALICEN'])}, ${c['DIRCEN'] as string | null}, ${Number(c['LATCEN'])}, ${Number(c['LONCEN'])},
              ${c['RADCEN'] === null ? null : Number(c['RADCEN'])}, ${sn('LUN')}, ${sn('MAR')}, ${sn('MIE')},
              ${sn('JUE')}, ${sn('VIE')}, ${sn('SAB')}, ${sn('DOM')}, ${Number(c['CODLAB'])}, ${usr})
      ON CONFLICT (codemp, codcen) DO UPDATE SET comcen = EXCLUDED.comcen, descen = EXCLUDED.descen,
        alicen = EXCLUDED.alicen, dircen = EXCLUDED.dircen, latcen = EXCLUDED.latcen, loncen = EXCLUDED.loncen,
        radcen = EXCLUDED.radcen, lun = EXCLUDED.lun, mar = EXCLUDED.mar, mie = EXCLUDED.mie, jue = EXCLUDED.jue,
        vie = EXCLUDED.vie, sab = EXCLUDED.sab, dom = EXCLUDED.dom, codlab = EXCLUDED.codlab,
        usract = ${usr}, dateact = now()`;
  }

  private upsertConductor(tx: Tx, codemp: string, c: Fila, usr: string) {
    return tx.$executeRaw`
      INSERT INTO conductor (codemp, rutcon, dvecon, nomcon, priapecon, segapecon, alicon, celcon, emailcon, usrcre)
      VALUES (${codemp}, ${Number(c['RUTCON'])}, ${String(c['DVECON']).toUpperCase()}, ${String(c['NOMCON'])},
              ${String(c['PRIAPECON'])}, ${c['SEGAPECON'] as string | null}, ${c['ALICON'] as string | null},
              ${normalizarCelularChile(String(c['CELCON']))}, ${c['EMAILCON'] as string | null}, ${usr})
      ON CONFLICT (codemp, rutcon) DO UPDATE SET nomcon = EXCLUDED.nomcon, priapecon = EXCLUDED.priapecon,
        segapecon = EXCLUDED.segapecon, alicon = EXCLUDED.alicon, celcon = EXCLUDED.celcon,
        emailcon = EXCLUDED.emailcon, usract = ${usr}, dateact = now()`;
  }

  private upsertRuta(tx: Tx, codemp: string, r: Fila, usr: string) {
    const estado =
      String(r['ESTRUT'] ?? 'ACTIVO').toUpperCase() === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO';
    return tx.$executeRaw`
      INSERT INTO ruta_conductor (codemp, rutcon, codcen, horrut, estrut, usrcre)
      VALUES (${codemp}, ${Number(r['RUTCON'])}, ${Number(r['CODCEN'])}, ${normalizarHora(r['HORRUT'])}::time, ${estado}, ${usr})
      ON CONFLICT (codemp, rutcon, codcen, horrut, diasem) DO UPDATE SET estrut = EXCLUDED.estrut,
        usract = ${usr}, dateact = now()`;
  }
}

/** Valor de una celda de exceljs (fórmulas, texto enriquecido, hipervínculos). */
function celda(v: unknown): unknown {
  if (v && typeof v === 'object') {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if ('result' in o) return o.result;
    if (o.richText) return o.richText.map((t) => t.text).join('');
    if ('text' in o) return o.text;
  }
  return typeof v === 'string' ? v.trim() : v;
}

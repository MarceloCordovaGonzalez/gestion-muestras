# Matriz de trazabilidad del Piloto 1 (código ↔ especificación v1.4)

| Requerimiento / regla                                    | Implementación                                                                                 | Prueba automatizada                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| CU-01 · RF-02 OTP y enrolamiento                         | `apps/api/src/modulos/identidad/identidad.ts` · `apps/mobile/lib/servicios/autenticacion.dart` | (integración en QA)                                      |
| RF-01, RF-07 · registrar marcación                       | `apps/api/src/modulos/marcaciones/*`                                                           | `apps/mobile/test/servicio_marcacion_test.dart`          |
| RN-03, RN-04, RN-05 · geovalidación, punto más cercano   | `packages/domain/src/geovalidacion.ts` · `apps/api/src/modulos/geovalidacion/*`                | `packages/domain/test/geovalidacion.test.ts`             |
| HAL-14 · continúa en laboratorios                        | `buscarCandidatos` (ambas listas siempre)                                                      | «HAL-14: sin coincidencia en centros…»                   |
| RN-22 · RF-28 · comuna en toda marcación                 | `GeovalidacionService.comunaDelPunto` (ST_Contains + respaldo) · `CHECK comuna NOT NULL`       | «…ERROR con FUERA_DE_GEOCERCA y comuna del punto»        |
| RN-21 · RF-26/27 · fuera de ruta                         | `packages/domain/src/fuera-ruta.ts` · aviso `RETIRO_FUERA_DE_RUTA` · mapa (anillo naranja)     | `dashboard-30-09.test.ts` (RN-21)                        |
| RN-07 · MEJ-07 · deduplicación (**activa**)              | `packages/domain/src/deduplicacion.ts` · 409 `POSIBLE_DUPLICADO`                               | `reglas-varias.test.ts` · `servicio_marcacion_test.dart` |
| RF-08 · operación sin conexión                           | `apps/mobile/lib/servicios/sincronizacion.dart` · idempotencia por IDVIA                       | `servicio_marcacion_test.dart`                           |
| RF-09 · precisión GPS (solo registro)                    | columna `viaje.precision`                                                                      | — (MVP3: validación)                                     |
| RN-06 · RNF-10 · zona horaria                            | `packages/domain/src/tiempo.ts` · `viaje.fecvia` generada                                      | `reglas-varias.test.ts` (zona horaria)                   |
| RN-08, RN-14 · RF-19 · retiros planificados              | `packages/domain/src/planificacion.ts` · `PlanificacionService` · job 00:05                    | `dashboard-30-09.test.ts` (RN-08)                        |
| RN-09 a RN-13 · RF-13/14/15 · dashboard                  | `packages/domain/src/kpi.ts` · `ConsultasService` · `apps/web/src/paginas/Dashboard.tsx`       | `dashboard-30-09.test.ts` (CU-04)                        |
| RF-10/11/12 · RN-17/18 · mapa                            | `ConsultasService.mapa` · `apps/web/src/paginas/Mapa.tsx`                                      | `dashboard-30-09.test.ts` (CU-03)                        |
| RF-16 · CU-05 · importación sin VIAJE                    | `packages/domain/src/importacion.ts` · `ImportacionService`                                    | `reglas-varias.test.ts` (CU-05, HAL-18)                  |
| RN-01 · RUT y celular                                    | `packages/domain/src/identificacion.ts` · `CHECK celcon`                                       | `reglas-varias.test.ts` (RN-01)                          |
| RN-16 · MEJ-18 · pendientes de entrega (**desactivado**) | `packages/domain/src/pendientes-entrega.ts` · `/v1/pendientes-entrega` (404 si apagado)        | `dashboard-30-09.test.ts` (RN-16)                        |
| RN-19 · bajas lógicas                                    | `PATCH /v1/maestros/:recurso/:codigo/estado`                                                   | —                                                        |
| RN-20 · CODEMP desde el JWT · RLS                        | `AutenticacionGuard` · `PrismaService.enEmpresa` · políticas RLS                               | —                                                        |
| RN-23 · Administrador que marca                          | `MarcacionesService.registrar` (exige rutcon e iddis)                                          | `apps/api/test/roles.guard.test.ts`                      |
| RF-25 · parámetros por empresa                           | `ParametrosService` · tabla `parametro`                                                        | `reglas-varias.test.ts` (indicadores)                    |

**Fuera del Piloto 1** (siguientes releases del MVP1 o MVP2): exportaciones (RF-23, CU-08),
gestión de errores (CU-10), administración de usuarios (CU-09), mantenedores con edición en
pantalla, cumplimiento y alertas push/correo (MVP2).

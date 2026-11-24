---
description: Revisa un Pull Request contra las reglas del proyecto
argument-hint: número de PR
---

Revise el PR **#$ARGUMENTS** (`gh pr view $ARGUMENTS` y `gh pr diff $ARGUMENTS`).

Verifique y reporte en una tabla (severidad, archivo:línea, hallazgo, sugerencia):

1. **Reglas de negocio:** ¿se respetan RN-03/04/05/07/21/22 y RF-09/RF-16 según `CLAUDE.md`? Si el
   diff toca geovalidación o comuna, delegue la revisión al subagente `revisor-geovalidacion`.
2. **Seguridad:** rol declarado en cada endpoint, `CODEMP` desde el JWT, sin datos personales en logs,
   sin secretos.
3. **Pruebas:** cada cambio de comportamiento tiene prueba; cobertura del dominio ≥ 90 %.
4. **Contrato:** `openapi.yaml` coherente con los DTO.
5. **Versionamiento:** título del PR es un Conventional Commit válido con el ámbito correcto; si hay
   cambio incompatible, lleva `!` y nota `BREAKING CHANGE`.
6. **Migraciones:** solo hacia adelante, reversibles por datos, con índices necesarios.

Termine con un veredicto: «Aprobar», «Aprobar con comentarios» o «Solicitar cambios».

---
description: Prepara y verifica una liberación de versión (release-please)
argument-hint: componente (api | web | mobile | domain) y ambiente destino (qa | prod)
---

Prepare la liberación para **$ARGUMENTS** según `docs/releases.md`:

1. Liste el PR abierto de release-please (`gh pr list --label "autorelease: pending"`) y muestre la
   versión propuesta y el CHANGELOG del componente.
2. Verifique que el número de versión sea coherente con los commits (feat → menor, fix → parche,
   `!` → mayor; en serie 0.x un cambio incompatible sube la menor).
3. Revise que `main` esté en verde y que dev funcione (salud `/v1/salud`).
4. Si el componente es `mobile`, verifique `version:` en `apps/mobile/pubspec.yaml` y el número de
   compilación.
5. Liste los riesgos y la lista de verificación de la marcha blanca (`docs/runbooks/release.md`).
6. No fusione el PR de release ni apruebe el ambiente `prod`: esa acción es del responsable humano.

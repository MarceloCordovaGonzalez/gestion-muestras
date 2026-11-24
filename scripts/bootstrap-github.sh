#!/usr/bin/env bash
# =============================================================================
# Publica el proyecto en GitHub y configura el control de versiones.
#
#   ./scripts/bootstrap-github.sh [owner/repo]     (por defecto MarceloCordovaGonzalez/gestion-muestras)
#
# Requisitos: git, gh (autenticado con «gh auth login», sin contraseñas en el script), pnpm 10,
# python3. Ejecútelo desde la raíz del proyecto descomprimido.
#
# Qué hace:
#   1. Genera pnpm-lock.yaml (necesario para CI con --frozen-lockfile).
#   2. Sube el código a la rama feat/piloto-1-scaffold y abre un PR hacia main
#      (si el repositorio está vacío, crea main con este contenido).
#   3. Crea las etiquetas (.github/labels.yml).
#   4. Protege main con un ruleset: PR obligatorio, 1 aprobación + CODEOWNERS, checks de CI,
#      historial lineal, sin force-push ni borrado.
#   5. Crea los ambientes dev, qa y prod (prod con aprobación manual del responsable).
# =============================================================================
set -euo pipefail

REPO="${1:-MarceloCordovaGonzalez/gestion-muestras}"
RAMA="feat/piloto-1-scaffold"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

paso() { printf '\n\033[1;34m» %s\033[0m\n' "$*"; }

gh auth status >/dev/null || { echo "Ejecute primero: gh auth login"; exit 1; }
YO="$(gh api user -q .login)"

# -----------------------------------------------------------------------------
paso "1/5 Dependencias y pnpm-lock.yaml"
if [[ ! -f pnpm-lock.yaml ]]; then pnpm install; fi
pnpm format          # formato uniforme antes del primer commit (CI ejecuta format:check)
pnpm --filter @gm/domain test

# -----------------------------------------------------------------------------
paso "2/5 Código en ${REPO}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
gh repo clone "$REPO" "$TMP/repo" -- --quiet
cd "$TMP/repo"
if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
  git switch -c "$RAMA" origin/main
  VACIO=0
else
  git switch -c main 2>/dev/null || git checkout -b main
  VACIO=1
fi
rsync -a --delete --exclude .git --exclude node_modules --exclude dist --exclude coverage "$RAIZ"/ ./
git add -A
git -c user.name="$(gh api user -q .name 2>/dev/null || echo "$YO")" \
    -c user.email="$(gh api user -q .email 2>/dev/null || echo "${YO}@users.noreply.github.com")" \
    commit -q -m "feat: estructura inicial del Piloto 1 (MVP1)

Monorepo con API NestJS + PostGIS, Web React, App Flutter, reglas de negocio puras
(packages/domain), contrato OpenAPI, CI/CD con GitHub Actions, release-please por componente,
Terraform para Google Cloud y configuración de Claude Code.

Base: Especificación Funcional v1.4 y Modelo de Arquitectura v1.4 (10/11/2026).
MEJ-07 (deduplicación) activa; MEJ-18 (pendientes de entrega) desactivada." || echo "(sin cambios)"

if [[ $VACIO == 1 ]]; then
  git push -u origin main
else
  git push -u origin "$RAMA"
  gh pr create --repo "$REPO" --base main --head "$RAMA" \
    --title "feat: estructura inicial del Piloto 1 (MVP1)" \
    --body-file .github/pull_request_template.md || echo "(el PR ya existe)"
fi
cd "$RAIZ"

# -----------------------------------------------------------------------------
paso "3/5 Etiquetas"
python3 - "$REPO" <<'PY'
import re, subprocess, sys
repo = sys.argv[1]
for linea in open('.github/labels.yml', encoding='utf-8'):
    m = re.search(r"name: '([^']+)', color: '([0-9A-Fa-f]{6})', description: '([^']*)'", linea)
    if m:
        n, c, d = m.groups()
        subprocess.run(['gh', 'label', 'create', n, '--repo', repo, '--color', c, '--description', d, '--force'], check=False)
PY

# -----------------------------------------------------------------------------
paso "4/5 Ruleset de protección de main"
gh api -X POST "repos/${REPO}/rulesets" --input - >/dev/null <<JSON || echo "(ruleset existente: revíselo en Settings → Rules)"
{
  "name": "proteccion-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "require_code_owner_review": true,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "cambios" },
          { "context": "titulo-pr" }
        ] } }
  ],
  "bypass_actors": []
}
JSON
gh api -X PATCH "repos/${REPO}" -f allow_squash_merge=true -f allow_merge_commit=false \
  -f allow_rebase_merge=false -f delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE >/dev/null

# -----------------------------------------------------------------------------
paso "5/5 Ambientes dev, qa y prod"
ID_YO="$(gh api user -q .id)"
gh api -X PUT "repos/${REPO}/environments/dev" >/dev/null
gh api -X PUT "repos/${REPO}/environments/qa" >/dev/null
gh api -X PUT "repos/${REPO}/environments/prod" --input - >/dev/null <<JSON
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [ { "type": "User", "id": ${ID_YO} } ],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON
gh api -X POST "repos/${REPO}/environments/prod/deployment-branch-policies" \
  -f name='*-v*' -f type=tag >/dev/null || true

cat <<FIN

✔ Listo. Pendientes manuales (Settings del repositorio):
  • Variables por ambiente (dev/qa/prod): GCP_PROJECT, GCP_WIF_PROVIDER, GCP_DEPLOY_SA,
    GCP_ARTIFACT_PROJECT, API_URL, WEB_BUCKET, GOOGLE_MAPS_API_KEY, FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN, FIREBASE_ANDROID_APP_ID.
  • Secretos: RELEASE_PLEASE_TOKEN (GitHub App o PAT fino con contents/pull-requests),
    GOOGLE_SERVICES_JSON, FIREBASE_DISTRIBUTION_CREDENTIALS.
  • Agregue más revisores a CODEOWNERS y al ambiente prod cuando se sume el equipo.
FIN

#Requires -Version 5.1
<#
.SYNOPSIS
  Levanta el entorno integral local (SOLO DESARROLLO): PostgreSQL + PostGIS, pgAdmin, API y Web.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\windows\levantar-entorno.ps1
  powershell -ExecutionPolicy Bypass -File scripts\windows\levantar-entorno.ps1 -Demo
    (-Demo además importa la planilla de demostración y simula la jornada del 30/09/2026)
#>
param([switch]$Demo)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$Raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $Raiz

function Paso([string]$texto) { Write-Host "`n» $texto" -ForegroundColor Cyan }
function Ejecutar([string]$programa, [string[]]$argumentos) {
  & $programa @argumentos
  if ($LASTEXITCODE -ne 0) { throw "Falló: $programa $($argumentos -join ' ')" }
}
function EsperarUrl([string]$url, [int]$segundos) {
  for ($i = 0; $i -lt $segundos; $i += 2) {
    try { Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2 | Out-Null; return $true } catch { Start-Sleep 2 }
  }
  return $false
}

Paso '1/7 Verificando herramientas'
foreach ($h in 'docker', 'node', 'pnpm') {
  if (-not (Get-Command $h -ErrorAction SilentlyContinue)) { throw "No se encontró '$h'. Revise la guía del entorno local." }
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop no está en ejecución. Ábralo y espere a que indique «Engine running».' }

Paso '2/7 Base de datos (PostGIS) y pgAdmin'
Ejecutar 'docker' @('compose', 'up', '-d')
for ($i = 0; $i -lt 60; $i++) {
  $estado = docker inspect -f '{{.State.Health.Status}}' gm-db
  if ($estado -eq 'healthy') { break }
  Start-Sleep 2
}
if ($estado -ne 'healthy') { throw 'La base de datos no quedó disponible. Revise: docker logs gm-db' }

Paso '3/7 Configuración (apps\api\.env)'
if (-not (Test-Path 'apps\api\.env')) { Copy-Item '.env.example' 'apps\api\.env'; Write-Host 'Creado apps\api\.env desde .env.example' }

Paso '4/7 Dependencias y compilación'
if (-not (Test-Path 'node_modules')) { Ejecutar 'pnpm' @('install') }
Ejecutar 'pnpm' @('--filter', '@gm/domain', 'build')
Ejecutar 'pnpm' @('--filter', '@gm/api', 'prisma:generate')

Paso '5/7 Migraciones'
Ejecutar 'pnpm' @('--filter', '@gm/api', 'prisma:migrate')

Paso '6/7 Comunas de desarrollo (sintéticas)'
$comunas = (docker exec gm-db psql -U gm -d gestion_muestras -tAc 'SELECT count(*) FROM comuna').Trim()
if ([int]$comunas -eq 0) {
  Ejecutar 'docker' @('cp', 'db\dev\comunas-desarrollo.sql', 'gm-db:/tmp/comunas-desarrollo.sql')
  Ejecutar 'docker' @('exec', 'gm-db', 'psql', '-U', 'gm', '-d', 'gestion_muestras', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '/tmp/comunas-desarrollo.sql')
} else { Write-Host "Catálogo COMUNA ya cargado ($comunas comunas)." }

Paso '7/7 API y Web (se abren en ventanas nuevas)'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$Raiz'; `$host.UI.RawUI.WindowTitle='GM · API'; pnpm --filter @gm/api dev"
if (-not (EsperarUrl 'http://localhost:8080/v1/salud' 120)) { throw 'La API no respondió en 2 minutos. Revise la ventana «GM · API».' }
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$Raiz'; `$host.UI.RawUI.WindowTitle='GM · Web'; pnpm --filter @gm/web dev"

if ($Demo) {
  Paso 'Datos de demostración: importación (CU-05) y jornada del 30/09/2026'
  Ejecutar 'pnpm' @('--filter', '@gm/api', 'demo:importar')
  Ejecutar 'pnpm' @('--filter', '@gm/api', 'demo:simular')
}

Write-Host "`n✔ Entorno levantado" -ForegroundColor Green
Write-Host '   Web (Administrador) : http://localhost:5173'
Write-Host '   API y Swagger       : http://localhost:8080/v1/docs'
Write-Host '   pgAdmin             : http://localhost:5050   (contraseña de la BD: gm_local_only)'
Write-Host '   App Android         : powershell -ExecutionPolicy Bypass -File scripts\windows\ejecutar-app.ps1'

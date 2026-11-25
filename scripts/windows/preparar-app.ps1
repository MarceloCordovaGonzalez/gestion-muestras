#Requires -Version 5.1
<#
.SYNOPSIS
  Genera la plataforma Android de la App (una sola vez) y aplica la configuración del proyecto:
  permisos de ubicación e Internet, minSdk 28 (Android 9, RNF-08) y HTTP sin cifrar SOLO en
  compilaciones de depuración (para llegar a la API local).
#>
$ErrorActionPreference = 'Stop'
$Movil = (Resolve-Path (Join-Path $PSScriptRoot '..\..\apps\mobile')).Path
Set-Location $Movil
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Ejecutar([string]$programa, [string[]]$argumentos) {
  & $programa @argumentos
  if ($LASTEXITCODE -ne 0) { throw "Falló: $programa $($argumentos -join ' ')" }
}

if (-not (Test-Path 'android')) {
  Write-Host '» Generando la plataforma Android (flutter create)…' -ForegroundColor Cyan
  Ejecutar 'flutter' @('create', '.', '--platforms', 'android', '--org', 'cl.techanalytic', '--project-name', 'gestion_muestras')
  # flutter create agrega una prueba de ejemplo que no corresponde a esta App.
  if (Test-Path 'test\widget_test.dart') { Remove-Item 'test\widget_test.dart' }
}

Write-Host '» Permisos (AndroidManifest principal)…' -ForegroundColor Cyan
$principal = 'android\app\src\main\AndroidManifest.xml'
$xml = [IO.File]::ReadAllText((Resolve-Path $principal))
if ($xml -notmatch 'ACCESS_FINE_LOCATION') {
  $permisos = @(
    '<uses-permission android:name="android.permission.INTERNET"/>',
    '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>',
    '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>',
    '    <application'
  ) -join "`n"
  $xml = ([regex]'<application').Replace($xml, $permisos, 1)
  [IO.File]::WriteAllText((Resolve-Path $principal), $xml, $utf8)
}

Write-Host '» HTTP sin cifrar solo en depuración (AndroidManifest de debug)…' -ForegroundColor Cyan
$debug = 'android\app\src\debug\AndroidManifest.xml'
$xml = [IO.File]::ReadAllText((Resolve-Path $debug))
if ($xml -notmatch 'usesCleartextTraffic') {
  $xml = $xml -replace '</manifest>', "    <application android:usesCleartextTraffic=`"true`" />`n</manifest>"
  [IO.File]::WriteAllText((Resolve-Path $debug), $xml, $utf8)
}

Write-Host '» minSdk 28 (Android 9)…' -ForegroundColor Cyan
$gradle = if (Test-Path 'android\app\build.gradle.kts') { 'android\app\build.gradle.kts' } else { 'android\app\build.gradle' }
$txt = [IO.File]::ReadAllText((Resolve-Path $gradle))
$txt = $txt -replace 'minSdk\s*=\s*flutter\.minSdkVersion', 'minSdk = 28'
$txt = $txt -replace 'minSdkVersion\s+flutter\.minSdkVersion', 'minSdkVersion 28'
[IO.File]::WriteAllText((Resolve-Path $gradle), $txt, $utf8)

Ejecutar 'flutter' @('pub', 'get')
Write-Host "`n✔ App preparada. Ejecútela con: powershell -ExecutionPolicy Bypass -File scripts\windows\ejecutar-app.ps1" -ForegroundColor Green

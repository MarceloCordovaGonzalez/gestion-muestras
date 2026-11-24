#Requires -Version 5.1
<#
.SYNOPSIS
  Ejecuta la App en el emulador o teléfono Android conectado, en modo desarrollo (sin Firebase).

.PARAMETER ApiUrl
  URL de la API. Por defecto http://10.0.2.2:8080/v1 (el PC visto desde el emulador). Para un
  teléfono físico use la IP del PC en la red Wi-Fi, p. ej. http://192.168.1.50:8080/v1.
#>
param([string]$ApiUrl = 'http://10.0.2.2:8080/v1')
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..\apps\mobile')).Path
if (-not (Test-Path 'android')) { throw 'Primero ejecute scripts\windows\preparar-app.ps1' }

$dispositivos = flutter devices --machine | ConvertFrom-Json | Where-Object { $_.targetPlatform -like 'android*' }
if (-not $dispositivos) { throw 'No hay un emulador ni un teléfono Android conectado. Inicie el emulador en Android Studio (Device Manager).' }
$id = @($dispositivos)[0].id
Write-Host "» Ejecutando en $(@($dispositivos)[0].name) · API $ApiUrl" -ForegroundColor Cyan
Write-Host '  Modo desarrollo: ingrese el celular del conductor (p. ej. +56912340001) y el código 123456.'
flutter run -d $id --dart-define=API_URL=$ApiUrl --dart-define=AMBIENTE=dev

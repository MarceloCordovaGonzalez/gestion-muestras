# Guía · Entorno Flutter en Windows para la App Android

Guía para preparar un computador **Windows 10/11 de 64 bits** y ejecutar la App del conductor
(`apps/mobile`) en un **emulador Android** o en un **teléfono Android**. Basada en la
documentación oficial de Flutter (consultada el 24/11/2026; versión estable vigente: 3.50).

Tiempo estimado: 60–90 minutos (la mayor parte son descargas). Espacio en disco: 20 GB libres.

---

## 1. Requisitos previos

| Requisito         | Detalle                                                          |
| ----------------- | ---------------------------------------------------------------- |
| Sistema operativo | Windows 10 o posterior, 64 bits, con PowerShell 5 o superior     |
| Memoria           | 8 GB mínimo; 16 GB recomendado para usar el emulador con fluidez |
| Virtualización    | Activada en la BIOS/UEFI (Intel VT-x o AMD-V) para el emulador   |
| Permisos          | Cuenta con permisos de administrador para instalar programas     |

## 2. Instalar Git para Windows

Abra **PowerShell** y ejecute:

```powershell
winget install --id Git.Git -e
```

Cierre y vuelva a abrir PowerShell, y verifique con `git --version`.

## 3. Instalar Android Studio

```powershell
winget install --id Google.AndroidStudio -e
```

1. Abra Android Studio y complete el asistente inicial con la opción **Standard**.
2. En la pantalla de bienvenida, abra **More Actions › SDK Manager**.
3. Pestaña **SDK Platforms**: marque la plataforma con **API Level 36** y pulse **Apply**.
4. Pestaña **SDK Tools**: verifique que estén marcados:
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
   - Android Emulator
   - Android SDK Platform-Tools
   - CMake
   - NDK (Side by side)
5. Pulse **Apply › OK › Finish**.

## 4. Instalar el SDK de Flutter (incluye Dart)

1. Descargue el `.zip` estable para Windows desde el archivo oficial del SDK:
   <https://docs.flutter.dev/install/archive>.
2. Extráigalo en `%USERPROFILE%\develop`. Evite rutas con espacios o caracteres especiales y
   carpetas que exijan privilegios elevados (por ejemplo, `C:\Program Files`):

   ```powershell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\develop" | Out-Null
   Expand-Archive -Path "$env:USERPROFILE\Downloads\flutter_windows_3.50.0-stable.zip" `
                  -DestinationPath "$env:USERPROFILE\develop"
   ```

   Ajuste el nombre del archivo a la versión descargada. Si falta `flutter.bat` en la carpeta
   `bin`, el antivirus lo puso en cuarentena: autorice la carpeta y extraiga nuevamente.

3. Agregue Flutter al `PATH` del usuario:
   - `Windows + Pausa` › **Configuración avanzada del sistema › Variables de entorno**.
   - En **Variables de usuario**, edite `Path` y agregue `%USERPROFILE%\develop\flutter\bin`.
   - Muévala al primer lugar con **Subir** y acepte tres veces.
4. Cierre y vuelva a abrir PowerShell, y verifique:

   ```powershell
   flutter --version
   dart --version
   ```

## 5. Aceptar licencias y verificar el entorno

```powershell
flutter doctor --android-licenses   # responda «y» a todas
flutter doctor
```

Debe ver ✓ en **Flutter**, **Android toolchain** y **Android Studio**. Las advertencias de
«Visual Studio» o «Chrome» se pueden ignorar: no se usan en este proyecto.

## 6. Preparar un dispositivo de prueba

### Opción A: emulador

1. En Android Studio: **More Actions › Virtual Device Manager › +**.
2. Elija un teléfono (por ejemplo, _Pixel 8_), una imagen de sistema **x86_64** reciente
   (descárguela si muestra el ícono de descarga) y, en **Additional settings › Emulated
   Performance**, ponga **Graphics acceleration** en una opción _Hardware_.
3. Inicie el emulador con el botón ▶.
4. Para simular la ubicación de una marcación: menú **⋯ › Location**, ingrese la latitud y la
   longitud (por ejemplo, −33.57691, −70.64935) y pulse **Set location**.

### Opción B: teléfono Android (Android 9 o superior, RNF-08)

1. En el teléfono: **Ajustes › Acerca del teléfono** y toque 7 veces **Número de compilación**
   para habilitar las **Opciones de desarrollador**.
2. En **Opciones de desarrollador**, active **Depuración por USB**.
3. Instale el controlador USB del fabricante (OEM) si Windows no reconoce el equipo:
   <https://developer.android.com/studio/run/oem-usb>.
4. Conecte el teléfono por USB y acepte la autorización del computador.

Verifique con:

```powershell
flutter emulators
flutter devices      # debe aparecer al menos un dispositivo «android»
```

## 7. Obtener el proyecto y generar la plataforma Android

```powershell
cd $env:USERPROFILE\develop
git clone https://github.com/MarceloCordovaGonzalez/gestion-muestras.git
cd gestion-muestras\apps\mobile
flutter create . --platforms android --org cl.techanalytic --project-name gestion_muestras
flutter pub get
```

Luego realice estos ajustes de la plataforma (no se versionan en el repositorio hasta que el
equipo decida incorporarlos):

1. `android\app\src\main\AndroidManifest.xml`, antes de `<application>`:

   ```xml
   <uses-permission android:name="android.permission.INTERNET"/>
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
   ```

2. `android\app\build.gradle.kts`: en `defaultConfig`, fije `minSdk = 28` (Android 9).

## 8. Configurar Firebase (autenticación OTP, CU-01)

La App usa Identity Platform/Firebase para el código SMS. Se requiere el proyecto Firebase del
ambiente **dev** (solicítelo al arquitecto del proyecto).

```powershell
dart pub global activate flutterfire_cli
npm install -g firebase-tools        # requiere Node.js: winget install OpenJS.NodeJS.LTS
firebase login
flutterfire configure --project=<id-proyecto-dev> --platforms=android
```

`flutterfire configure` descarga `google-services.json` y configura Gradle. **No versione ese
archivo** (está en `.gitignore`).

Para la verificación por SMS en Android, registre la huella SHA-1 y SHA-256 del certificado de
depuración en la consola de Firebase (**Configuración del proyecto › Tus apps › Android**):

```powershell
cd android
.\gradlew signingReport
```

En pruebas, use **números de teléfono de prueba** con código fijo (**Authentication › Sign-in
method › Teléfono › Números de teléfono para pruebas**) para no consumir SMS.

## 9. Ejecutar la App

Con la API de desarrollo local en ejecución (ver `docs/desarrollo-local.md`):

```powershell
# Emulador (10.0.2.2 es el computador anfitrión visto desde el emulador)
flutter run --dart-define=API_URL=http://10.0.2.2:8080/v1 --dart-define=AMBIENTE=dev

# Teléfono físico en la misma red Wi-Fi (reemplace por la IP de su computador: ipconfig)
flutter run --dart-define=API_URL=http://192.168.1.50:8080/v1 --dart-define=AMBIENTE=dev
```

Para usar la API del ambiente **dev** en la nube, reemplace `API_URL` por su URL HTTPS.

## 10. Verificaciones antes de abrir un Pull Request

```powershell
dart format lib test
flutter analyze
flutter test
```

Son las mismas verificaciones que ejecuta GitHub Actions (job `mobile` del CI).

## 11. Problemas frecuentes

| Síntoma                                    | Solución                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `flutter` no se reconoce                   | Revise el `PATH` (paso 4) y reabra PowerShell                               |
| `Android license status unknown`           | `flutter doctor --android-licenses`                                         |
| `cmdline-tools component is missing`       | Instale **Android SDK Command-line Tools** (paso 3)                         |
| El emulador no inicia o es lento           | Active la virtualización en la BIOS/UEFI y Hyper-V/WHPX en Windows          |
| `flutter devices` no muestra el teléfono   | Controlador OEM, cable con datos y autorización de depuración               |
| La App no llega a la API desde el emulador | Use `10.0.2.2`, no `localhost`; revise el firewall de Windows (puerto 8080) |
| Error de verificación SMS en Android       | Registre SHA-1/SHA-256 en Firebase y use números de prueba                  |

Referencias: [Flutter en Windows para Android](https://docs.flutter.dev/get-started/install/windows/mobile) ·
[Configurar Android en Windows](https://docs.flutter.dev/platform-integration/android/install-android/install-android-from-windows) ·
[Instalación manual del SDK](https://docs.flutter.dev/install/manual).

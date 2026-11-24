# App del conductor (Flutter)

Funciones del Piloto 1: CU-01 (OTP y enrolamiento), CU-02 (marcación con confirmación), historial
del día, cola local cifrada sin conexión (RF-08) y registro de la precisión GPS (RF-09, solo
registro). La validación de precisión, la detección de ubicación simulada y Play Integrity /
App Attest corresponden al MVP3.

> Guía completa para Windows + Android: [`docs/guia-flutter-windows-android.md`](../../docs/guia-flutter-windows-android.md).

## Primera configuración (una vez)

Este repositorio versiona solo `lib/`, `test/` y la configuración. Genere las carpetas de
plataforma con:

```bash
cd apps/mobile
flutter create . --platforms android,ios --org cl.techanalytic --project-name gestion_muestras
flutter pub get
```

Luego agregue:

- **Android** (`android/app/src/main/AndroidManifest.xml`): `ACCESS_FINE_LOCATION`,
  `ACCESS_COARSE_LOCATION`, `INTERNET`. `minSdkVersion 28` (Android 9, RNF-08).
- **iOS** (`ios/Runner/Info.plist`): `NSLocationWhenInUseUsageDescription` con el texto
  informativo validado por el área legal (RNF-05). Deployment target 15.0.
- Archivos de Firebase por ambiente (`google-services.json`, `GoogleService-Info.plist`):
  **no se versionan**; en CI se inyectan desde secretos.

## Ejecución

```bash
flutter run --dart-define=API_URL=http://10.0.2.2:8080/v1 --dart-define=AMBIENTE=dev
flutter analyze && flutter test
```

## Versionamiento

`version:` de `pubspec.yaml` lo actualiza release-please (componente `mobile`). El número de
compilación (`+N`) lo fija el pipeline con el número de ejecución de GitHub Actions.

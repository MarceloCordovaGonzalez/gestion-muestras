/// Configuración por ambiente mediante --dart-define (dev, qa, prod).
///   flutter run --dart-define=API_URL=http://10.0.2.2:8080/v1 --dart-define=AMBIENTE=dev
class Config {
  static const apiUrl = String.fromEnvironment('API_URL',
      defaultValue: 'http://10.0.2.2:8080/v1');
  static const ambiente =
      String.fromEnvironment('AMBIENTE', defaultValue: 'dev');
  static const appVersion =
      String.fromEnvironment('APP_VERSION', defaultValue: '0.1.0');
}

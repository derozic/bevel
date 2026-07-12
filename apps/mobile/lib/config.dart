/// BEVEL native client configuration.
///
/// Override at build time:
///   flutter run --dart-define=BEVEL_BASE_URL=https://2x4m.bevel.lvh.me
///   flutter build macos --dart-define=BEVEL_BASE_URL=https://app.bevel.com
class BevelConfig {
  BevelConfig._();

  static const String appName = 'BEVEL';
  static const String appTagline =
      'Workspace channels for humans and agents';

  /// Default workspace origin. Local multi-tenant surface uses .lvh.me.
  static const String baseUrl = String.fromEnvironment(
    'BEVEL_BASE_URL',
    defaultValue: 'https://2x4m.bevel.lvh.me',
  );

  static const String downloadPath = '/download';
  static const String loginPath = '/login';

  /// Semantic version shown in About / release notes (mirrors pubspec).
  static const String versionLabel = '0.1.0';

  static Uri workspaceUri([String path = '/']) {
    final base = Uri.parse(baseUrl);
    return base.replace(path: path.startsWith('/') ? path : '/$path');
  }
}

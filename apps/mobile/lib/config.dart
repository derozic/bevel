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

  /// Hosts that may load inside the in-app WebView (workspace + local multi-tenant).
  /// Everything else (OAuth IdPs, arbitrary HTTPS) opens in the system browser.
  static bool isAllowedInAppHost(String host) {
    final h = host.toLowerCase();
    if (h.isEmpty) return false;

    final baseHost = Uri.parse(baseUrl).host.toLowerCase();
    if (h == baseHost) return true;

    // Local multi-tenant surfaces (Caddy .lvh.me)
    if (h.endsWith('.lvh.me') || h == 'lvh.me') return true;

    // Same registrable domain as configured workspace (e.g. app.bevel.com → *.bevel.com)
    final parts = baseHost.split('.');
    if (parts.length >= 2) {
      final suffix = parts.sublist(parts.length - 2).join('.');
      if (h == suffix || h.endsWith('.$suffix')) return true;
    }
    return false;
  }

  static bool isAllowedInAppUri(Uri uri) {
    if (uri.scheme != 'http' && uri.scheme != 'https') return false;
    return isAllowedInAppHost(uri.host);
  }
}

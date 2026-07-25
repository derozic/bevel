/// BEVEL native client configuration.
///
/// **Default is live production** (bevel.is / api.bevel.is / bevel.2x4m.cc).
/// Local Caddy overrides only when you explicitly pass dart-defines:
///
///   flutter run -d macos \
///     --dart-define=BEVEL_BASE_URL=https://bevel.2x4m.lvh.me \
///     --dart-define=BEVEL_API_URL=https://api.bevel.lvh.me \
///     --dart-define=BEVEL_WORKSPACE_URL=https://bevel.2x4m.lvh.me
///
/// Release (same as defaults):
///   ./scripts/mobile/release.sh macos
///   # or BEVEL_ENV=local for .lvh.me
class BevelConfig {
  BevelConfig._();

  static const String appName = 'BEVEL';
  static const String appTagline =
      'Channels for humans and agents';

  /// Platform entry (login, claim, download). Live: bevel.is.
  static const String baseUrl = String.fromEnvironment(
    'BEVEL_BASE_URL',
    defaultValue: 'https://bevel.is',
  );

  /// Workspace chat origin. Live: bevel.2x4m.cc.
  static const String _workspaceUrlRaw = String.fromEnvironment(
    'BEVEL_WORKSPACE_URL',
    defaultValue: 'https://bevel.2x4m.cc',
  );

  static String get workspaceUrl =>
      _workspaceUrlRaw.isEmpty ? baseUrl : _workspaceUrlRaw;

  static const String downloadPath = '/download';
  static const String loginPath = '/login';

  /// Semantic version shown in About / release notes (mirrors pubspec).
  static const String versionLabel = '0.2.0';

  /// Magenta Extensions + analytics API.
  static const String magentaApiBase = String.fromEnvironment(
    'MAGENTA_API_BASE',
    defaultValue: 'https://api.magenta.ac',
  );

  /// Operator console for Magenta Extensions (Bevel connection).
  static const String magentaSettingsUrl = String.fromEnvironment(
    'MAGENTA_SETTINGS_URL',
    defaultValue: 'https://bevel.is/console/settings?section=magenta',
  );

  static const String magentaExtensionsAdminUrl =
      'https://admin.magenta.ac/extensions';

  /// Entry / platform URI (login, claim, download).
  static Uri entryUri([String path = '/']) {
    final base = Uri.parse(baseUrl);
    return base.replace(path: path.startsWith('/') ? path : '/$path');
  }

  /// Workspace URI opened inside the in-app WebView.
  static Uri workspaceUri([String path = '/']) {
    final base = Uri.parse(workspaceUrl);
    return base.replace(path: path.startsWith('/') ? path : '/$path');
  }

  /// Hosts that may load inside the in-app WebView.
  /// Everything else (OAuth IdPs, arbitrary HTTPS) opens in the system browser.
  static bool isAllowedInAppHost(String host) {
    final h = host.toLowerCase();
    if (h.isEmpty) return false;

    final baseHost = Uri.parse(baseUrl).host.toLowerCase();
    final workspaceHost = Uri.parse(workspaceUrl).host.toLowerCase();
    if (h == baseHost || h == workspaceHost) return true;

    // Production platform + API + realtime + workspace tenants.
    const productionHosts = <String>{
      'bevel.is',
      'www.bevel.is',
      'api.bevel.is',
      'realtime.bevel.is',
      'bevel.2x4m.cc',
    };
    if (productionHosts.contains(h)) return true;
    if (h.endsWith('.bevel.is')) return true;
    if (h.endsWith('.2x4m.cc') && h.contains('bevel')) return true;

    // Local multi-tenant surfaces (Caddy .lvh.me) when dart-defines override.
    if (h.endsWith('.lvh.me') || h == 'lvh.me') return true;

    // Same registrable domain as configured entry or workspace.
    for (final configured in [baseHost, workspaceHost]) {
      final parts = configured.split('.');
      if (parts.length >= 2) {
        final suffix = parts.sublist(parts.length - 2).join('.');
        if (h == suffix || h.endsWith('.$suffix')) return true;
      }
    }
    return false;
  }

  static bool isAllowedInAppUri(Uri uri) {
    if (uri.scheme != 'http' && uri.scheme != 'https') return false;
    return isAllowedInAppHost(uri.host);
  }

  /// Control-plane API — always live by default (api.bevel.is).
  static const String apiBaseUrl = String.fromEnvironment(
    'BEVEL_API_URL',
    defaultValue: 'https://api.bevel.is',
  );

  /// OAuth IdP hosts and Auth.js sign-in paths that must leave the WebView.
  /// Google blocks embedded WebViews; system browser / ASWebAuthenticationSession
  /// is required for reliable Google and GitHub sign-in.
  static bool isOAuthNavigation(Uri uri) {
    final host = uri.host.toLowerCase();
    final path = uri.path.toLowerCase();

    const idpHosts = <String>{
      'accounts.google.com',
      'oauth2.googleapis.com',
      'github.com',
      'api.github.com',
      'login.microsoftonline.com',
      'appleid.apple.com',
    };
    if (idpHosts.contains(host) ||
        (host.endsWith('.google.com') &&
            (path.contains('oauth') ||
                path.contains('signin') ||
                path.contains('ServiceLogin')))) {
      return true;
    }

    // Auth.js provider start + callback — complete outside WKWebView
    if (path.contains('/api/auth/signin') ||
        path.contains('/api/auth/callback') ||
        path.contains('/api/auth/signout')) {
      return true;
    }
    return false;
  }

  /// Prefer system browser for the whole login surface (cookie + OAuth hop).
  /// Starts on platform entry ([baseUrl]) with native return deep link.
  static Uri systemBrowserLoginUri() {
    return entryUri(loginPath).replace(
      queryParameters: {
        ...entryUri(loginPath).queryParameters,
        'native': '1',
        'return': 'bevel://auth/complete',
      },
    );
  }

  /// True when this build points at production hosts (not local .lvh.me).
  static bool get isProduction {
    final h = Uri.parse(baseUrl).host.toLowerCase();
    final api = Uri.parse(apiBaseUrl).host.toLowerCase();
    return h == 'bevel.is' ||
        h.endsWith('.bevel.is') ||
        h.contains('2x4m.cc') ||
        api == 'api.bevel.is';
  }
}

/// BEVEL native client configuration.
///
/// **Default is live production** (bevel.is / api.bevel.is / bevel.2x4m.cc)
/// so Google Workspace login works. Local Caddy only when you pass
/// `BEVEL_ENV=local` or explicit dart-defines:
///
///   flutter run -d macos
///   pnpm mobile:run:macos:local
///   BEVEL_ENV=local ./scripts/mobile/release.sh macos
class BevelConfig {
  BevelConfig._();

  static const String appName = 'BEVEL';
  static const String appTagline =
      'Channels for humans and agents';

  static const String _env = String.fromEnvironment('BEVEL_ENV');
  static const String _baseUrlOverride = String.fromEnvironment('BEVEL_BASE_URL');
  static const String _workspaceUrlOverride =
      String.fromEnvironment('BEVEL_WORKSPACE_URL');
  static const String _apiUrlOverride = String.fromEnvironment('BEVEL_API_URL');

  static bool get _useLocalHosts => _env == 'local' || _env == 'dev';

  /// Platform entry (login, claim, download).
  static String get baseUrl {
    if (_baseUrlOverride.isNotEmpty) return _baseUrlOverride;
    return _useLocalHosts
        ? 'https://bevel.2x4m.lvh.me'
        : 'https://bevel.is';
  }

  /// Workspace chat origin.
  static String get workspaceUrl {
    if (_workspaceUrlOverride.isNotEmpty) return _workspaceUrlOverride;
    return _useLocalHosts
        ? 'https://bevel.2x4m.lvh.me'
        : 'https://bevel.2x4m.cc';
  }

  static const String downloadPath = '/download';
  static const String loginPath = '/login';

  /// Semantic version shown in About / release notes (mirrors pubspec).
  static const String versionLabel = '0.4.7';

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

  /// Control-plane API.
  static String get apiBaseUrl {
    if (_apiUrlOverride.isNotEmpty) return _apiUrlOverride;
    return _useLocalHosts
        ? 'https://api.bevel.lvh.me'
        : 'https://api.bevel.is';
  }

  /// Optional internal key for trusted native builds (release dart-define).
  /// Required for timeline/escalation calls that assert identity headers.
  /// Never commit the real value; set via CI / 1Password at build time.
  static const String fleetInternalApiKey = String.fromEnvironment(
    'FLEET_INTERNAL_API_KEY',
    defaultValue: '',
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

    // Handoff redeem and Auth.js callbacks must stay in the WebView.
    // Opening /api/auth/signin or /native-complete in the system browser
    // starts another Google hop and loops 4–5 times.
    return false;
  }

  /// Prefer system browser for the whole login surface (cookie + OAuth hop).
  /// Always start on bevel.is — Google OAuth is registered there. Local
  /// `.lvh.me` is not configured and used to show "Google sign-in is not
  /// configured on this server."
  static Uri systemBrowserLoginUri() {
    return Uri.https('bevel.is', loginPath, const {
      'native': '1',
      'callbackUrl': '/api/auth/native-complete',
    });
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

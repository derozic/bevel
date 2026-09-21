// BEVEL native client configuration.
//
// Default is live production (bevel.is / api.bevel.is / bevel.2x4m.cc)
// so Google Workspace login works in the Silicon app.
//
// Desktop developer mode (runtime, persisted) switches the same build to
// local Caddy .lvh.me hosts without a rebuild:
//
//   bevel.is            -> bevel.lvh.me
//   api.bevel.is        -> api.bevel.lvh.me
//   bevel.2x4m.cc       -> bevel.2x4m.lvh.me
//
// Compile-time BEVEL_ENV=local starts with developer mode on (first launch).
// Explicit BEVEL_BASE_URL / BEVEL_API_URL / BEVEL_WORKSPACE_URL dart-defines
// apply only when developer mode is off.

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class BevelConfig {
  BevelConfig._();

  static const String appName = 'BEVEL';
  static const String appTagline = 'Channels for humans and agents';

  static const String _env = String.fromEnvironment('BEVEL_ENV');
  static const String _baseUrlOverride = String.fromEnvironment('BEVEL_BASE_URL');
  static const String _workspaceUrlOverride =
      String.fromEnvironment('BEVEL_WORKSPACE_URL');
  static const String _apiUrlOverride = String.fromEnvironment('BEVEL_API_URL');
  static const String _magentaSettingsOverride = String.fromEnvironment(
    'MAGENTA_SETTINGS_URL',
  );

  static const String prodBaseUrl = 'https://bevel.is';
  static const String prodWorkspaceUrl = 'https://bevel.2x4m.cc';
  static const String prodApiUrl = 'https://api.bevel.is';

  /// Apex local entry — same role as bevel.is. Not the 2x4m org host.
  static const String localBaseUrl = 'https://bevel.lvh.me';
  static const String localWorkspaceUrl = 'https://bevel.2x4m.lvh.me';
  static const String localApiUrl = 'https://api.bevel.lvh.me';

  static const String _prefKey = 'bevel.developerMode';

  static final ValueNotifier<bool> developerMode = ValueNotifier<bool>(false);

  static bool get _useLocalHosts => _env == 'local' || _env == 'dev';

  /// Load persisted developer mode. Local compile (`BEVEL_ENV=local`) defaults
  /// on until the operator saves a choice.
  static Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getBool(_prefKey);
      developerMode.value = saved ?? _useLocalHosts;
    } catch (_) {
      developerMode.value = _useLocalHosts;
    }
  }

  static Future<void> setDeveloperMode(bool enabled) async {
    developerMode.value = enabled;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefKey, enabled);
    } catch (_) {
      /* tests / missing plugin */
    }
  }

  static bool get isDeveloperMode => developerMode.value;

  /// Desktop-only: Silicon / Windows / Linux can flip hosts at runtime.
  static bool get supportsDeveloperMode {
    if (kIsWeb) return false;
    switch (defaultTargetPlatform) {
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
        return true;
      default:
        return false;
    }
  }

  /// Platform entry (login, claim, download, Private).
  static String get baseUrl {
    if (isDeveloperMode) return localBaseUrl;
    if (_baseUrlOverride.isNotEmpty) return _baseUrlOverride;
    return _useLocalHosts ? localBaseUrl : prodBaseUrl;
  }

  /// Org workspace chat origin (2x4m product host).
  static String get workspaceUrl {
    if (isDeveloperMode) return localWorkspaceUrl;
    if (_workspaceUrlOverride.isNotEmpty) return _workspaceUrlOverride;
    return _useLocalHosts ? localWorkspaceUrl : prodWorkspaceUrl;
  }

  static const String downloadPath = '/download';
  static const String loginPath = '/login';

  /// Semantic version shown in About / release notes (mirrors pubspec).
  static const String versionLabel = '1.0.0';

  /// WKWebView user agent. Desktop must look like Safari — a `Mobile` token
  /// makes the workspace render phone chrome inside a Silicon window.
  static String webViewUserAgent([TargetPlatform? platform, bool tablet = false]) {
    final p = platform ?? defaultTargetPlatform;
    final v = versionLabel;
    switch (p) {
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
        return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
            'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 '
            'Safari/605.1.15 BevelNative/$v';
      case TargetPlatform.iOS:
        if (tablet) {
          return 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) '
              'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 '
              'Mobile/15E148 Safari/604.1 BevelNative/$v';
        }
        return 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
            'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 '
            'Mobile/15E148 Safari/604.1 BevelNative/$v';
      default:
        return 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
            'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 '
            'Mobile/15E148 Safari/604.1 BevelNative/$v';
    }
  }

  /// Magenta Extensions + analytics API.
  static const String magentaApiBase = String.fromEnvironment(
    'MAGENTA_API_BASE',
    defaultValue: 'https://api.magenta.ac',
  );

  /// Operator console for Magenta Extensions (Bevel connection).
  static String get magentaSettingsUrl {
    if (_magentaSettingsOverride.isNotEmpty && !isDeveloperMode) {
      return _magentaSettingsOverride;
    }
    return '${isDeveloperMode ? localBaseUrl : prodBaseUrl}/console/settings?section=magenta';
  }

  static const String magentaExtensionsAdminUrl =
      'https://admin.magenta.ac/extensions';

  /// Entry / platform URI (login, claim, download).
  static Uri entryUri([String path = '/']) {
    final base = Uri.parse(baseUrl);
    return base.replace(path: path.startsWith('/') ? path : '/$path');
  }

  /// Workspace URI opened inside the in-app WebView.
  static Uri workspaceUri([String path = '/']) {
    return resolveOnOrigin(Uri.parse(workspaceUrl), path);
  }

  /// Join a host origin with a relative path that may include `?msg=`.
  /// `Uri.replace(path: '/~general?msg=x')` would put the query in the path.
  static Uri resolveOnOrigin(Uri origin, String pathAndQuery) {
    final raw = pathAndQuery.trim();
    if (raw.isEmpty || raw == '/') {
      return origin.replace(path: '/', query: '', fragment: '');
    }
    final parsed = Uri.parse(raw.startsWith('/') ? raw : '/$raw');
    if (parsed.hasScheme || parsed.hasAuthority) {
      return origin.replace(path: '/~general', query: '', fragment: '');
    }
    return origin.replace(
      path: parsed.path.isEmpty ? '/' : parsed.path,
      query: parsed.query,
      fragment: parsed.fragment,
    );
  }

  static bool isApexHost(String host) {
    final h = host.toLowerCase().split(':').first;
    return h == 'bevel.is' ||
        h == 'www.bevel.is' ||
        h == 'app.bevel.is' ||
        h == 'bevel.lvh.me';
  }

  /// Map a saved host onto the current environment (prod ↔ local).
  static String remapHost(String host) {
    final h = host.toLowerCase().split(':').first.trim();
    if (h.isEmpty) return isDeveloperMode ? 'bevel.lvh.me' : 'bevel.is';
    if (isDeveloperMode) return toLocalHost(h);
    return toProductionHost(h);
  }

  static String toLocalHost(String host) {
    final h = host.toLowerCase().split(':').first;
    if (h == 'bevel.is' || h == 'www.bevel.is' || h == 'app.bevel.is') {
      return 'bevel.lvh.me';
    }
    if (h == 'api.bevel.is') return 'api.bevel.lvh.me';
    if (h == 'realtime.bevel.is') return 'realtime.bevel.lvh.me';
    if (h == 'status.bevel.is') return 'status.bevel.lvh.me';
    if (h.endsWith('.2x4m.cc')) {
      return h.replaceAll('.2x4m.cc', '.2x4m.lvh.me');
    }
    if (h.endsWith('.bevel.is')) {
      return '${h.substring(0, h.length - '.bevel.is'.length)}.bevel.lvh.me';
    }
    return h;
  }

  static String toProductionHost(String host) {
    final h = host.toLowerCase().split(':').first;
    if (h == 'bevel.lvh.me') return 'bevel.is';
    if (h == 'api.bevel.lvh.me') return 'api.bevel.is';
    if (h == 'realtime.bevel.lvh.me') return 'realtime.bevel.is';
    if (h == 'status.bevel.lvh.me') return 'status.bevel.is';
    if (h == 'bevel.2x4m.lvh.me') return 'bevel.2x4m.cc';
    if (h.endsWith('.2x4m.lvh.me')) {
      return h.replaceAll('.2x4m.lvh.me', '.2x4m.cc');
    }
    if (h.endsWith('.bevel.lvh.me')) {
      return '${h.substring(0, h.length - '.bevel.lvh.me'.length)}.bevel.is';
    }
    return h;
  }

  /// Hosts that may load inside the in-app WebView.
  /// Everything else (OAuth IdPs, arbitrary HTTPS) opens in the system browser.
  static bool isAllowedInAppHost(String host) {
    final h = host.toLowerCase();
    if (h.isEmpty) return false;

    final baseHost = Uri.parse(baseUrl).host.toLowerCase();
    final workspaceHost = Uri.parse(workspaceUrl).host.toLowerCase();
    if (h == baseHost || h == workspaceHost) return true;

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

    if (h.endsWith('.lvh.me') || h == 'lvh.me') return true;

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
    if (isDeveloperMode) return localApiUrl;
    if (_apiUrlOverride.isNotEmpty) return _apiUrlOverride;
    return _useLocalHosts ? localApiUrl : prodApiUrl;
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
    return false;
  }

  /// Prefer system browser for the whole login surface (cookie + OAuth hop).
  /// Production: bevel.is. Developer mode: bevel.lvh.me.
  static Uri systemBrowserLoginUri() {
    return entryUri(loginPath).replace(
      queryParameters: const {
        'native': '1',
        'callbackUrl': '/api/auth/native-complete',
      },
    );
  }

  /// True when this session points at production hosts (not local .lvh.me).
  static bool get isProduction {
    if (isDeveloperMode) return false;
    final h = Uri.parse(baseUrl).host.toLowerCase();
    final api = Uri.parse(apiBaseUrl).host.toLowerCase();
    return h == 'bevel.is' ||
        h.endsWith('.bevel.is') ||
        h.contains('2x4m.cc') ||
        api == 'api.bevel.is';
  }

  static String get environmentLabel =>
      isDeveloperMode ? 'Developer · ${Uri.parse(baseUrl).host}' : 'Production';
}

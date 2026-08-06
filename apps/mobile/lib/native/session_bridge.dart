import '../config.dart';

/// Builds the WebView URL that redeems a one-time auth handoff code.
///
/// System-browser Google OAuth leaves cookies in Safari/Chrome, not in
/// WKWebView / Android WebView. The durable path is:
///
///   1. native-complete mints FastAPI handoff code
///   2. bevel://auth/complete?code=… deep link returns to the app
///   3. WebView loads this redeem URL on the **workspace host**
///   4. Auth.js sets host-local session cookies in the WebView jar
class SessionBridge {
  SessionBridge._();

  /// Workspace-host redeem URL. [callbackPath] must be a relative path.
  static Uri handoffRedeemUri({
    required String code,
    String? callbackPath,
    String? workspaceOrigin,
  }) {
    final origin = (workspaceOrigin != null && workspaceOrigin.isNotEmpty)
        ? workspaceOrigin
        : BevelConfig.workspaceUrl;
    final base = Uri.parse(origin);
    final path = _safeCallback(callbackPath);
    return base.replace(
      path: '/api/auth/handoff',
      queryParameters: {
        'code': code,
        'callbackUrl': path,
      },
    );
  }

  /// Session probe endpoint (Auth.js) on the workspace host.
  static Uri sessionProbeUri({String? workspaceOrigin}) {
    final origin = (workspaceOrigin != null && workspaceOrigin.isNotEmpty)
        ? workspaceOrigin
        : BevelConfig.workspaceUrl;
    final base = Uri.parse(origin);
    return base.replace(path: '/api/auth/session');
  }

  /// JS snippet that returns a JSON string of the Auth.js session (or null).
  /// Evaluate with [WebViewController.runJavaScriptReturningResult].
  static const String sessionProbeJs = r'''
(async function() {
  try {
    const r = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
    if (!r.ok) return 'null';
    const j = await r.json();
    return JSON.stringify(j && j.user ? j : null);
  } catch (e) {
    return 'null';
  }
})()
''';

  /// JS to list fleet channels (cookie-authenticated BFF).
  static const String listChannelsJs = r'''
(async function() {
  try {
    const r = await fetch('/api/fleet/channels', { credentials: 'include', cache: 'no-store' });
    if (!r.ok) return '[]';
    const j = await r.json();
    const ch = j.channels || j || [];
    return JSON.stringify(Array.isArray(ch) ? ch : []);
  } catch (e) {
    return '[]';
  }
})()
''';

  static String _safeCallback(String? path) {
    final p = (path == null || path.isEmpty) ? '/~general' : path.trim();
    if (p.startsWith('/') && !p.startsWith('//')) return p;
    return '/~general';
  }

  /// Strip outer quotes from WebView JS string results (iOS often wraps).
  static String unwrapJsString(Object? raw) {
    if (raw == null) return '';
    var s = raw.toString().trim();
    if (s.length >= 2 &&
        ((s.startsWith('"') && s.endsWith('"')) ||
            (s.startsWith("'") && s.endsWith("'")))) {
      s = s.substring(1, s.length - 1);
      s = s.replaceAll(r'\"', '"').replaceAll(r"\'", "'");
    }
    // iOS may also double-escape
    if (s == 'null' || s == 'undefined') return '';
    return s;
  }
}

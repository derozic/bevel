import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';

/// Opens OAuth / login outside the in-app WebView.
///
/// Google and other IdPs reject or break embedded WKWebView / Android WebView
/// sessions. On Apple platforms the durable approach is the system browser
/// (Safari) or ASWebAuthenticationSession; here we use [LaunchMode.externalApplication]
/// which surfaces Safari / Chrome Custom Tabs depending on the OS.
///
/// After sign-in, Auth.js sets cookies on AUTH_COOKIE_DOMAIN (e.g. `.lvh.me`).
/// The native shell then reloads the workspace via deep link `bevel://auth/complete`.
/// Note: system Safari and WKWebView do not always share cookies on macOS —
/// prefer OTP email inside the shell when cookie hop fails, or complete the
/// full session in the system browser.
class OAuthBrowser {
  const OAuthBrowser();

  Future<bool> openSystemLogin() {
    return open(BevelConfig.systemBrowserLoginUri());
  }

  Future<bool> openGoogleSignIn() {
    final base = BevelConfig.workspaceUri('/api/auth/signin/google');
    return open(base);
  }

  Future<bool> openGitHubSignIn() {
    final base = BevelConfig.workspaceUri('/api/auth/signin/github');
    return open(base);
  }

  Future<bool> open(Uri uri) async {
    if (kIsWeb) return false;
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }
}

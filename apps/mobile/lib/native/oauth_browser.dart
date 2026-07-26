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
/// Production flow (platform entry at bevel.is):
///   1. openSystemLogin() → https://bevel.is/login?native=1&return=bevel://auth/complete
///   2. Google OAuth completes in Safari
///   3. Auth handoff code + bevel://auth/complete deep link
///   4. App reloads workspace (bevel.2x4m.cc) inside WKWebView
///
/// Note: system Safari and WKWebView do not always share cookies on macOS —
/// the handoff-code path (not shared cookie domain) is required across
/// bevel.is ↔ bevel.2x4m.cc. Until cookie inject lands, prefer finishing
/// session in system browser then reopening the workspace shell.
class OAuthBrowser {
  const OAuthBrowser();

  Future<bool> openSystemLogin() {
    return open(BevelConfig.systemBrowserLoginUri());
  }

  Future<bool> openGoogleSignIn() {
    // Sign-in always starts on platform entry host (not workspace tenant).
    final base = BevelConfig.entryUri('/api/auth/signin/google');
    return open(base);
  }

  Future<bool> openGitHubSignIn() {
    final base = BevelConfig.entryUri('/api/auth/signin/github');
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

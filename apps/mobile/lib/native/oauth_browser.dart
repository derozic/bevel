import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';

/// Legacy OAuth via system browser — **fallback only**.
///
/// Preferred path is [GoogleNativeAuth] (Google Sign-In SDK / in-app account
/// sheet) → `/api/v1/auth/google-native` handoff → WebView redeem.
///
/// Keep this for recovery when native Google Sign-In is unavailable.
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

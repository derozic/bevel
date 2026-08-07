import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;

import '../config.dart';

/// Result of native Google Workspace sign-in + server handoff mint.
class GoogleNativeAuthResult {
  const GoogleNativeAuthResult({
    required this.email,
    required this.handoffCode,
    this.name,
    this.userId,
    this.imageUrl,
    this.tenantSlug,
    this.callbackPath,
    this.workspaceHost,
  });

  final String email;
  final String handoffCode;
  final String? name;
  final String? userId;
  final String? imageUrl;
  final String? tenantSlug;
  final String? callbackPath;
  final String? workspaceHost;
}

/// In-app Google account picker (Google Sign-In SDK) — not Safari / Chrome.
///
/// Flow:
///   1. Native Google UI → ID token
///   2. POST /api/v1/auth/google-native → one-time handoff code
///   3. WebView redeems handoff on workspace host (Auth.js cookies in jar)
class GoogleNativeAuth {
  GoogleNativeAuth({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  GoogleSignIn? _signIn;

  /// Web OAuth client ID (AUTH_GOOGLE_ID) — used as serverClientId so Google
  /// issues an ID token the API can verify.
  static const String serverClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com',
  );

  /// Optional iOS client ID (dart-define or same as server when only web client exists).
  static const String iosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
    defaultValue:
        '336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com',
  );

  GoogleSignIn get _google {
    return _signIn ??= GoogleSignIn(
      scopes: const <String>['email', 'profile', 'openid'],
      serverClientId: serverClientId,
      // iOS: explicit client id (GoogleService-Info may lack CLIENT_ID until
      // an iOS OAuth client is created in Cloud Console).
      clientId: defaultTargetPlatform == TargetPlatform.iOS ||
              defaultTargetPlatform == TargetPlatform.macOS
          ? iosClientId
          : null,
      hostedDomain: null, // any Workspace domain at platform entry
    );
  }

  Future<GoogleNativeAuthResult?> signIn({
    String tenantSlug = '2x4m',
    String callbackPath = '/~general',
    String? workspaceHost,
  }) async {
    if (kIsWeb) return null;
    try {
      // Prefer interactive account picker every time user taps Continue.
      await _google.signOut();
    } catch (_) {
      /* ignore */
    }

    final account = await _google.signIn();
    if (account == null) {
      // User cancelled
      return null;
    }

    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw StateError(
        'Google Sign-In did not return an ID token. '
        'Ensure GOOGLE_SERVER_CLIENT_ID is the web OAuth client and '
        'iOS URL scheme / CLIENT_ID are configured.',
      );
    }

    final uri = Uri.parse(
      '${BevelConfig.apiBaseUrl}/api/v1/auth/google-native',
    );
    final res = await _client
        .post(
          uri,
          headers: const {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: jsonEncode({
            'idToken': idToken,
            'accessToken': auth.accessToken,
            'tenantSlug': tenantSlug,
            'callbackPath': callbackPath,
          }),
        )
        .timeout(const Duration(seconds: 20));

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw StateError(
        'Native Google login failed (${res.statusCode}): ${res.body}',
      );
    }

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final code = (data['code'] ?? '').toString();
    final email = (data['email'] ?? account.email).toString();
    if (code.isEmpty || email.isEmpty) {
      throw StateError('Server returned incomplete handoff payload');
    }

    return GoogleNativeAuthResult(
      email: email,
      handoffCode: code,
      name: (data['name'] ?? account.displayName)?.toString(),
      userId: data['userId']?.toString(),
      imageUrl: (data['imageUrl'] ?? account.photoUrl)?.toString(),
      tenantSlug: (data['tenantSlug'] ?? tenantSlug).toString(),
      callbackPath: (data['callbackPath'] ?? callbackPath).toString(),
      workspaceHost: workspaceHost,
    );
  }

  Future<void> signOut() async {
    try {
      await _google.signOut();
    } catch (_) {
      /* ignore */
    }
  }
}

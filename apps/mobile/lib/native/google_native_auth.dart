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

/// In-app Google account picker (Google Sign-In SDK) — not Safari.
///
/// Requires an **iOS** / **Android** OAuth client (not WEB). Using a WEB client
/// causes: "Custom scheme URIs are not allowed for 'WEB' client type".
///
/// Flow:
///   1. Native Google UI → ID token
///   2. POST /api/v1/auth/google-native → one-time handoff code
///   3. WebView redeems handoff on workspace host (Auth.js cookies in jar)
class GoogleNativeAuth {
  GoogleNativeAuth({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  GoogleSignIn? _signIn;

  /// Web OAuth client — used as [serverClientId] so Google issues an ID token
  /// the API can verify (audience = this client).
  static const String serverClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com',
  );

  /// iOS OAuth client ID (type **iOS**, bundle com.derozic.bevel.bevelApp).
  /// Empty until created in Google Cloud Console — do NOT put a WEB client here.
  static const String iosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
    defaultValue: '',
  );

  /// Android OAuth client ID (type **Android**, package + SHA-1). Optional when
  /// google-services.json already wires the client.
  static const String androidClientId = String.fromEnvironment(
    'GOOGLE_ANDROID_CLIENT_ID',
    defaultValue: '',
  );

  bool get hasIosClientConfigured => iosClientId.trim().isNotEmpty;

  GoogleSignIn _buildGoogle() {
    final isApple = defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS;

    // iOS: require a real iOS client — WEB client causes Error 400 custom scheme.
    String? clientId;
    if (isApple) {
      final ios = iosClientId.trim();
      if (ios.isEmpty) {
        throw StateError(
          'Missing GOOGLE_IOS_CLIENT_ID. Create an OAuth client of type iOS '
          '(bundle id com.derozic.bevel.bevelApp) in Google Cloud project '
          'x4m-493516 / 2x4m, then rebuild with '
          '--dart-define=GOOGLE_IOS_CLIENT_ID=….apps.googleusercontent.com '
          'and set the matching REVERSED_CLIENT_ID URL scheme in Info.plist.',
        );
      }
      clientId = ios;
    } else if (androidClientId.trim().isNotEmpty) {
      clientId = androidClientId.trim();
    }

    return GoogleSignIn(
      scopes: const <String>['email', 'profile', 'openid'],
      serverClientId: serverClientId,
      clientId: clientId,
      hostedDomain: null,
    );
  }

  GoogleSignIn get _google => _signIn ??= _buildGoogle();

  Future<GoogleNativeAuthResult?> signIn({
    String tenantSlug = '2x4m',
    String callbackPath = '/~general',
    String? workspaceHost,
  }) async {
    if (kIsWeb) return null;

    try {
      await _google.signOut();
    } catch (_) {
      /* ignore */
    }

    final account = await _google.signIn();
    if (account == null) {
      return null; // cancelled
    }

    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw StateError(
        'Google Sign-In returned no ID token. Check that serverClientId is the '
        'WEB OAuth client and the platform client is type iOS/Android (not WEB).',
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

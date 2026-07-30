import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Initializes Firebase + FCM/APNs when platform config is present.
///
/// Without `GoogleService-Info.plist` / `google-services.json` (from 1Password),
/// [ensureInitialized] returns false and the app continues with local
/// notifications only.
class PushBootstrap {
  PushBootstrap._();

  static bool _attempted = false;
  static bool _ready = false;
  static String? _lastError;

  static bool get isReady => _ready;
  static String? get lastError => _lastError;

  /// Safe to call multiple times. Never throws to callers.
  static Future<bool> ensureInitialized() async {
    if (kIsWeb) return false;
    if (_ready) return true;
    if (_attempted) return _ready;
    _attempted = true;

    if (!(Platform.isIOS || Platform.isAndroid || Platform.isMacOS)) {
      return false;
    }

    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      final messaging = FirebaseMessaging.instance;

      // iOS / macOS: request permission for remote (APNs via FCM)
      if (Platform.isIOS || Platform.isMacOS) {
        await messaging.requestPermission(
          alert: true,
          badge: true,
          sound: true,
          provisional: false,
        );
        // Ensure APNs token is requested before FCM token
        await messaging.setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );
      }

      _ready = true;
      _lastError = null;
      return true;
    } catch (e) {
      _ready = false;
      _lastError = e.toString();
      debugPrint(
        'PushBootstrap: Firebase not configured ($e). '
        'Copy GoogleService-Info.plist / google-services.json from 1Password. '
        'See docs/NATIVE_PUSH.md',
      );
      return false;
    }
  }

  /// FCM registration token (Android) or APNs-backed FCM token (iOS).
  static Future<String?> deviceToken() async {
    final ok = await ensureInitialized();
    if (!ok) return null;
    try {
      final messaging = FirebaseMessaging.instance;
      // On iOS, wait briefly for APNs token after permission
      if (Platform.isIOS || Platform.isMacOS) {
        final apns = await messaging.getAPNSToken();
        if (apns == null) {
          // First launch can race APNs registration
          await Future<void>.delayed(const Duration(milliseconds: 800));
        }
      }
      final token = await messaging.getToken();
      return (token != null && token.isNotEmpty) ? token : null;
    } catch (e) {
      _lastError = e.toString();
      debugPrint('PushBootstrap.deviceToken failed: $e');
      return null;
    }
  }

  /// Listen for token refresh and re-register via [onToken].
  static StreamSubscription<String>? listenTokenRefresh(
    void Function(String token) onToken,
  ) {
    if (!_ready) return null;
    return FirebaseMessaging.instance.onTokenRefresh.listen(onToken);
  }
}

/// Background handler must be a top-level function.
@pragma('vm:entry-point')
Future<void> bevelFirebaseMessagingBackgroundHandler(
  RemoteMessage message,
) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Config missing — ignore
  }
}

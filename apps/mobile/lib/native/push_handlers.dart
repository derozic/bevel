import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'notification_service.dart';
import 'push_bootstrap.dart';
import 'push_registration.dart';

/// Wires FCM foreground / opened-app handlers into [NotificationService].
///
/// Call after [NotificationService.initialize] and permission grant.
class PushHandlers {
  PushHandlers._();

  static StreamSubscription<RemoteMessage>? _onMessage;
  static StreamSubscription<RemoteMessage>? _onOpened;
  static StreamSubscription<String>? _onRefresh;
  static var _wired = false;

  /// Install listeners once. Safe if Firebase is not configured.
  static Future<void> install({
    required NotificationService notifications,
    String? userId,
    String? tenantSlug,
    void Function(String payload)? onOpenPayload,
  }) async {
    final ok = await PushBootstrap.ensureInitialized();
    if (!ok) return;

    // Register current token (and re-register with user id when known)
    unawaited(
      notifications.syncPushToken(userId: userId, tenantSlug: tenantSlug),
    );

    if (_wired) {
      // Still update refresh callback identity
      return;
    }
    _wired = true;

    try {
      FirebaseMessaging.onBackgroundMessage(
        bevelFirebaseMessagingBackgroundHandler,
      );
    } catch (_) {
      // Already registered or unsupported platform
    }

    _onMessage?.cancel();
    _onMessage = FirebaseMessaging.onMessage.listen((message) async {
      final title = message.notification?.title ??
          message.data['title'] ??
          'BEVEL';
      final body = message.notification?.body ??
          message.data['body'] ??
          message.data['bodyPreview'] ??
          '';
      final payload = message.data['payload'] ??
          message.data['deepLink'] ??
          message.data['timeline'] ??
          'bevel://timeline';
      final kind = (message.data['kind'] ?? '').toString().toLowerCase();
      final id = DateTime.now().millisecondsSinceEpoch.remainder(100000);
      if (kind == 'escalation') {
        await notifications.showEscalationAlert(
          id: id,
          title: title,
          body: body,
          payload: payload,
        );
      } else {
        await notifications.showWorkspaceAlert(
          id: id,
          title: title,
          body: body,
          payload: payload,
        );
      }
    });

    _onOpened?.cancel();
    _onOpened = FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final payload = message.data['payload'] ??
          message.data['deepLink'] ??
          message.data['timeline'];
      if (payload != null && payload.isNotEmpty) {
        onOpenPayload?.call(payload);
        notifications.onNotificationTap?.call(payload);
      }
    });

    // Cold start from FCM
    try {
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) {
        final payload = initial.data['payload'] ??
            initial.data['deepLink'] ??
            initial.data['timeline'];
        if (payload != null && payload.isNotEmpty) {
          onOpenPayload?.call(payload);
          notifications.onNotificationTap?.call(payload);
        }
      }
    } catch (e) {
      debugPrint('PushHandlers getInitialMessage: $e');
    }

    _onRefresh?.cancel();
    final reg = PushRegistrationService();
    _onRefresh = PushBootstrap.listenTokenRefresh((token) {
      unawaited(
        reg.registerToken(
          token: token,
          userId: userId,
          tenantSlug: tenantSlug,
        ),
      );
    });
  }

  static Future<void> dispose() async {
    await _onMessage?.cancel();
    await _onOpened?.cancel();
    await _onRefresh?.cancel();
    _onMessage = null;
    _onOpened = null;
    _onRefresh = null;
    _wired = false;
  }
}

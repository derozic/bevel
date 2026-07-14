import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

import 'push_registration.dart';

/// Local notifications + permission bootstrap.
///
/// Push (APNs / FCM): after permission grant, [syncPushToken] POSTs the device
/// token to `POST /api/v1/devices/push-tokens` when a platform token is available.
class NotificationService {
  NotificationService({
    FlutterLocalNotificationsPlugin? plugin,
    PushRegistrationService? pushRegistration,
  })  : _plugin = plugin ?? FlutterLocalNotificationsPlugin(),
        _push = pushRegistration ?? PushRegistrationService();

  final FlutterLocalNotificationsPlugin _plugin;
  final PushRegistrationService _push;
  bool _ready = false;

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'bevel_workspace',
    'Workspace activity',
    description: 'Channel messages, mentions, and agent updates',
    importance: Importance.high,
  );

  bool get isSupported {
    if (kIsWeb) return false;
    return Platform.isIOS || Platform.isAndroid || Platform.isMacOS;
  }

  Future<void> initialize() async {
    if (!isSupported || _ready) return;

    tz.initializeTimeZones();

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwinInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    await _plugin.initialize(
      const InitializationSettings(
        android: androidInit,
        iOS: darwinInit,
        macOS: darwinInit,
      ),
      onDidReceiveNotificationResponse: _onResponse,
    );

    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(_channel);

    _ready = true;
  }

  void _onResponse(NotificationResponse response) {
    // Deep-link payload: channel id / session id for the Flutter router.
    // Example: bevel://channel/product
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;
    // Consumers listen via a stream in a later PR when app routing lands.
  }

  /// Request OS notification permission (iOS provisional optional later).
  Future<bool> requestPermission() async {
    if (!isSupported) return false;

    if (Platform.isAndroid) {
      final status = await Permission.notification.request();
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await android?.requestNotificationsPermission();
      return status.isGranted || status.isLimited;
    }

    if (Platform.isIOS) {
      final ios = _plugin.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      return await ios?.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          ) ??
          false;
    }

    if (Platform.isMacOS) {
      final mac = _plugin.resolvePlatformSpecificImplementation<
          MacOSFlutterLocalNotificationsPlugin>();
      return await mac?.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          ) ??
          false;
    }

    return false;
  }

  /// Attempt to obtain an APNs/FCM token and register it with the control plane.
  /// No-ops until platform push plugins are configured (returns false).
  Future<bool> syncPushToken({String? userId, String? tenantSlug}) async {
    final token = await _push.fetchPlatformDeviceToken();
    if (token == null || token.isEmpty) return false;
    return _push.registerToken(
      token: token,
      userId: userId,
      tenantSlug: tenantSlug,
    );
  }

  Future<void> showWorkspaceAlert({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_ready) await initialize();

    await _plugin.show(
      id,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
        macOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: payload,
    );
  }

  /// Schedule a local reminder (e.g. standup / vote window).
  Future<void> schedule({
    required int id,
    required String title,
    required String body,
    required DateTime when,
    String? payload,
  }) async {
    if (!_ready) await initialize();
    final scheduled = tz.TZDateTime.from(when, tz.local);

    await _plugin.zonedSchedule(
      id,
      title,
      body,
      scheduled,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
        macOS: const DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: payload,
    );
  }
}

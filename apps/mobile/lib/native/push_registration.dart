import 'dart:convert';
import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config.dart';
import 'push_bootstrap.dart';

/// Registers APNs / FCM device tokens with the BEVEL control plane.
class PushRegistrationService {
  PushRegistrationService({http.Client? client})
      : _client = client ?? http.Client();

  final http.Client _client;

  Uri get _endpoint =>
      Uri.parse('${BevelConfig.apiBaseUrl}/api/v1/devices/push-tokens');

  Future<bool> registerToken({
    required String token,
    String? userId,
    String? tenantSlug,
  }) async {
    if (kIsWeb || token.isEmpty) return false;

    final platform = Platform.isIOS
        ? 'ios'
        : Platform.isAndroid
            ? 'android'
            : Platform.isMacOS
                ? 'macos'
                : 'web';

    String deviceModel = '';
    try {
      final info = DeviceInfoPlugin();
      if (Platform.isIOS) {
        final ios = await info.iosInfo;
        deviceModel = ios.utsname.machine;
      } else if (Platform.isAndroid) {
        final android = await info.androidInfo;
        deviceModel = '${android.manufacturer} ${android.model}';
      } else if (Platform.isMacOS) {
        final mac = await info.macOsInfo;
        deviceModel = mac.model;
      }
    } catch (_) {
      // Best-effort metadata only.
    }

    try {
      final res = await _client.post(
        _endpoint,
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({
          'token': token,
          'platform': platform,
          'userId': userId ?? '',
          'tenantSlug': tenantSlug ?? '',
          'deviceModel': deviceModel,
          'appVersion': BevelConfig.versionLabel,
          'provider': 'fcm',
        }),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  /// FCM token (Android) or APNs-backed FCM token (iOS/macOS).
  /// Returns null when Firebase platform files are missing or OS denies push.
  Future<String?> fetchPlatformDeviceToken() async {
    if (kIsWeb) return null;
    return PushBootstrap.deviceToken();
  }
}

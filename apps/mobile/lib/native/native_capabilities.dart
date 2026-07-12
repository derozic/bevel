import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Snapshot of what this install can do on the host OS.
class NativeCapabilities {
  const NativeCapabilities({
    required this.platformLabel,
    required this.appVersion,
    required this.buildNumber,
    required this.deviceModel,
    required this.osVersion,
    required this.supportsShare,
    required this.supportsNotifications,
    required this.supportsHealth,
    required this.supportsHealthConnect,
    required this.supportsHealthKit,
    required this.supportsDeepLinks,
    required this.isAppleSiliconMac,
  });

  final String platformLabel;
  final String appVersion;
  final String buildNumber;
  final String deviceModel;
  final String osVersion;
  final bool supportsShare;
  final bool supportsNotifications;
  final bool supportsHealth;
  final bool supportsHealthConnect;
  final bool supportsHealthKit;
  final bool supportsDeepLinks;
  final bool isAppleSiliconMac;

  static Future<NativeCapabilities> probe() async {
    var appVersion = '0.0.0';
    var buildNumber = '0';
    try {
      final package = await PackageInfo.fromPlatform();
      appVersion = package.version;
      buildNumber = package.buildNumber;
    } catch (_) {
      // Unit tests without plugin bindings.
    }

    final device = DeviceInfoPlugin();

    var platformLabel = 'unknown';
    var deviceModel = 'unknown';
    var osVersion = 'unknown';
    var isAppleSiliconMac = false;
    var supportsHealthKit = false;
    var supportsHealthConnect = false;

    try {
      if (kIsWeb) {
        platformLabel = 'web';
      } else if (Platform.isIOS) {
        platformLabel = 'ios';
        final info = await device.iosInfo;
        deviceModel = info.utsname.machine;
        osVersion = info.systemVersion;
        supportsHealthKit = true;
      } else if (Platform.isAndroid) {
        platformLabel = 'android';
        final info = await device.androidInfo;
        deviceModel = '${info.manufacturer} ${info.model}';
        osVersion =
            'Android ${info.version.release} (API ${info.version.sdkInt})';
        supportsHealthConnect = info.version.sdkInt >= 26;
      } else if (Platform.isMacOS) {
        platformLabel = 'macos';
        final info = await device.macOsInfo;
        deviceModel = info.model;
        osVersion = info.osRelease;
        isAppleSiliconMac = info.arch.toLowerCase().contains('arm');
        supportsHealthKit = false;
      }
    } catch (_) {
      if (!kIsWeb) {
        if (Platform.isIOS) {
          platformLabel = 'ios';
          supportsHealthKit = true;
        } else if (Platform.isAndroid) {
          platformLabel = 'android';
          supportsHealthConnect = true;
        } else if (Platform.isMacOS) {
          platformLabel = 'macos';
        }
      }
    }

    final mobile = !kIsWeb && (Platform.isIOS || Platform.isAndroid);

    return NativeCapabilities(
      platformLabel: platformLabel,
      appVersion: appVersion,
      buildNumber: buildNumber,
      deviceModel: deviceModel,
      osVersion: osVersion,
      supportsShare: !kIsWeb,
      supportsNotifications: mobile || (!kIsWeb && Platform.isMacOS),
      supportsHealth: supportsHealthKit || supportsHealthConnect,
      supportsHealthConnect: supportsHealthConnect,
      supportsHealthKit: supportsHealthKit,
      supportsDeepLinks: mobile,
      isAppleSiliconMac: isAppleSiliconMac,
    );
  }
}

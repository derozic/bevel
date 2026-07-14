import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:health/health.dart';

/// Unified HealthKit (iOS) + Health Connect (Android) access.
///
/// BEVEL uses health only with explicit user consent — for agent coaching,
/// presence "sentience" signals, and optional wellness automations.
/// Never write clinical decisions without a clear user action.
class HealthService {
  HealthService({Health? health}) : _health = health ?? Health();

  final Health _health;

  static const List<HealthDataType> defaultReadTypes = [
    HealthDataType.STEPS,
    HealthDataType.HEART_RATE,
    HealthDataType.ACTIVE_ENERGY_BURNED,
    HealthDataType.SLEEP_ASLEEP,
    HealthDataType.WORKOUT,
  ];

  static const List<HealthDataType> defaultWriteTypes = [
    HealthDataType.WORKOUT,
  ];

  bool get isSupported {
    if (kIsWeb) return false;
    return Platform.isIOS || Platform.isAndroid;
  }

  String get backendLabel {
    if (Platform.isIOS) return 'Apple HealthKit';
    if (Platform.isAndroid) return 'Google Health Connect';
    return 'Unavailable';
  }

  /// Configure the plugin (call once at app start on mobile).
  Future<void> configure() async {
    if (!isSupported) return;
    await _health.configure();
  }

  Future<bool> hasPermissions({
    List<HealthDataType> types = defaultReadTypes,
  }) async {
    if (!isSupported) return false;
    final statuses = await _health.hasPermissions(types);
    return statuses == true;
  }

  /// Request read (and optional write) authorization.
  Future<bool> requestAuthorization({
    List<HealthDataType> read = defaultReadTypes,
    List<HealthDataType> write = defaultWriteTypes,
  }) async {
    if (!isSupported) return false;
    final types = <HealthDataType>{...read, ...write}.toList();
    final permissions = types
        .map(
          (t) => write.contains(t)
              ? HealthDataAccess.READ_WRITE
              : HealthDataAccess.READ,
        )
        .toList();
    return _health.requestAuthorization(types, permissions: permissions);
  }

  /// Recent steps total (last 24h) for presence / sentience chips.
  Future<int?> stepsLast24Hours() async {
    if (!isSupported) return null;
    final now = DateTime.now();
    final from = now.subtract(const Duration(hours: 24));
    try {
      return await _health.getTotalStepsInInterval(from, now);
    } catch (_) {
      return null;
    }
  }

  /// Sample heart-rate points for agent context (user-gated).
  Future<List<HealthDataPoint>> heartRateSamples({
    Duration lookback = const Duration(hours: 6),
  }) async {
    if (!isSupported) return const [];
    final now = DateTime.now();
    final from = now.subtract(lookback);
    try {
      return await _health.getHealthDataFromTypes(
        types: [HealthDataType.HEART_RATE],
        startTime: from,
        endTime: now,
      );
    } catch (_) {
      return const [];
    }
  }

  Future<List<HealthDataPoint>> sleepSamples({
    Duration lookback = const Duration(hours: 36),
  }) async {
    if (!isSupported) return const [];
    final now = DateTime.now();
    final from = now.subtract(lookback);
    try {
      return await _health.getHealthDataFromTypes(
        types: [HealthDataType.SLEEP_ASLEEP],
        startTime: from,
        endTime: now,
      );
    } catch (_) {
      return const [];
    }
  }
}

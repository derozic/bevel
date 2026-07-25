import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// A local media device discovered on the host (mic, speaker, camera).
///
/// Used for audio huddles: pick preferred input/output before joining WebRTC.
/// Native Silicon discovery is more reliable than browser `enumerateDevices`
/// (stable ids across restarts, full CoreAudio/AVFoundation labels, sandboxed
/// permission flow).
class BevelMediaDevice {
  const BevelMediaDevice({
    required this.id,
    required this.label,
    required this.kind,
    this.isDefault = false,
  });

  final String id;
  final String label;

  /// audioinput | audiooutput | videoinput
  final String kind;
  final bool isDefault;

  factory BevelMediaDevice.fromMap(Map<dynamic, dynamic> map) {
    return BevelMediaDevice(
      id: map['id']?.toString() ?? '',
      label: map['label']?.toString() ?? 'Unknown device',
      kind: map['kind']?.toString() ?? 'audioinput',
      isDefault: map['isDefault'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'kind': kind,
        'isDefault': isDefault,
      };
}

/// Snapshot of host media devices for huddles / media prefs.
class MediaDeviceInventory {
  const MediaDeviceInventory({
    required this.microphones,
    required this.speakers,
    required this.cameras,
    required this.platform,
    this.error,
  });

  final List<BevelMediaDevice> microphones;
  final List<BevelMediaDevice> speakers;
  final List<BevelMediaDevice> cameras;
  final String platform;
  final String? error;

  bool get isEmpty =>
      microphones.isEmpty && speakers.isEmpty && cameras.isEmpty;

  String get summary {
    if (error != null) return error!;
    return '${microphones.length} mic · ${speakers.length} speaker · '
        '${cameras.length} camera';
  }
}

/// Discovers host audio/video devices for huddles and media settings.
///
/// **Why native (Silicon Flutter) beats browser install:**
/// - Full CoreAudio / AVFoundation enumeration with stable device IDs
/// - Sandbox entitlements for mic/camera without ephemeral browser tabs
/// - Same inventory feeds future CallKit / WebRTC huddle join
/// - PWA `enumerateDevices` often returns empty labels until getUserMedia
///   and cannot match native system defaults as cleanly
class MediaDeviceDiscovery {
  MediaDeviceDiscovery({MethodChannel? channel})
      : _channel = channel ??
            const MethodChannel('com.derozic.bevel/media_devices');

  final MethodChannel _channel;

  static bool get isSupportedPlatform {
    if (kIsWeb) return false;
    return Platform.isMacOS || Platform.isIOS || Platform.isAndroid;
  }

  /// Probe devices. On macOS uses AVFoundation + CoreAudio via platform channel.
  Future<MediaDeviceInventory> enumerate() async {
    if (!isSupportedPlatform) {
      return const MediaDeviceInventory(
        microphones: [],
        speakers: [],
        cameras: [],
        platform: 'unsupported',
        error: 'Device discovery requires the native app (not browser install)',
      );
    }

    try {
      final raw = await _channel.invokeMethod<dynamic>('enumerateDevices');
      if (raw is! Map) {
        return MediaDeviceInventory(
          microphones: const [],
          speakers: const [],
          cameras: const [],
          platform: Platform.operatingSystem,
          error: 'Unexpected discovery payload',
        );
      }
      final map = Map<dynamic, dynamic>.from(raw);
      List<BevelMediaDevice> parse(String key) {
        final list = map[key];
        if (list is! List) return const [];
        return list
            .whereType<Map>()
            .map((e) => BevelMediaDevice.fromMap(Map<dynamic, dynamic>.from(e)))
            .where((d) => d.id.isNotEmpty)
            .toList();
      }

      return MediaDeviceInventory(
        microphones: parse('microphones'),
        speakers: parse('speakers'),
        cameras: parse('cameras'),
        platform: map['platform']?.toString() ?? Platform.operatingSystem,
        error: map['error']?.toString(),
      );
    } on MissingPluginException {
      return MediaDeviceInventory(
        microphones: const [],
        speakers: const [],
        cameras: const [],
        platform: Platform.operatingSystem,
        error:
            'Native media channel not registered — rebuild the Silicon app',
      );
    } on PlatformException catch (e) {
      return MediaDeviceInventory(
        microphones: const [],
        speakers: const [],
        cameras: const [],
        platform: Platform.operatingSystem,
        error: e.message ?? e.code,
      );
    } catch (e) {
      return MediaDeviceInventory(
        microphones: const [],
        speakers: const [],
        cameras: const [],
        platform: Platform.operatingSystem,
        error: e.toString(),
      );
    }
  }

  /// Request mic (and optionally camera) permission so labels fill in.
  Future<bool> requestAccess({bool camera = false}) async {
    if (!isSupportedPlatform) return false;
    try {
      final ok = await _channel.invokeMethod<bool>(
        'requestAccess',
        <String, dynamic>{'camera': camera},
      );
      return ok == true;
    } catch (_) {
      return false;
    }
  }
}

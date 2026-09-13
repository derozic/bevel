import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Apple Intelligence / Neural Engine brief — stays on device.
class OnDeviceIntelligence {
  OnDeviceIntelligence._();

  static const _channel = MethodChannel('bevel/on_device_intelligence');

  static bool get isSupportedPlatform {
    if (kIsWeb) return false;
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        return true;
      default:
        return false;
    }
  }

  static Future<Map<String, dynamic>> capabilities() async {
    if (!isSupportedPlatform) {
      return const {'foundationModels': false, 'onDevice': false};
    }
    try {
      final raw = await _channel.invokeMapMethod<String, dynamic>('capabilities');
      return raw ?? const {};
    } catch (e) {
      debugPrint('OnDeviceIntelligence.capabilities: $e');
      return const {'foundationModels': false, 'onDevice': false};
    }
  }

  static Future<String> summarize(String text) async {
    if (text.trim().isEmpty) return '';
    final out = await _channel.invokeMethod<String>('summarize', {'text': text});
    return (out ?? '').trim();
  }

  static Future<String> rewrite(String text, {String tone = 'clear'}) async {
    if (text.trim().isEmpty) return '';
    final out = await _channel.invokeMethod<String>('rewrite', {
      'text': text,
      'tone': tone,
    });
    return (out ?? '').trim();
  }
}

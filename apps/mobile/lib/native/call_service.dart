import 'package:flutter/foundation.dart';

/// Product surface for voice “health calls” (CallKit / ConnectionService).
///
/// Scaffold only — full CallKit / Telecom ConnectionService requires:
/// - iOS: CallKit + PushKit (VoIP push) entitlements
/// - Android: ConnectionService / TelecomManager + FOREGROUND_SERVICE_PHONE_CALL
/// - A signaling path on BEVEL realtime (invite → ring → answer → WebRTC)
///
/// When ready, plug in `flutter_callkit_incoming` (or platform channels) and
/// implement [CallServicePlatform]. Keep this facade stable for the UI layer.
abstract class CallService {
  Future<bool> get isSupported;

  /// Report an incoming call to the system UI (native call screen).
  Future<void> reportIncoming({
    required String callId,
    required String handle,
    String? displayName,
  });

  /// Start an outgoing call.
  Future<void> startOutgoing({
    required String callId,
    required String handle,
    String? displayName,
  });

  Future<void> endCall(String callId);
}

/// No-op implementation until CallKit / ConnectionService packages ship.
class StubCallService implements CallService {
  const StubCallService();

  @override
  Future<bool> get isSupported async => false;

  @override
  Future<void> reportIncoming({
    required String callId,
    required String handle,
    String? displayName,
  }) async {
    if (kDebugMode) {
      // ignore: avoid_print
      print(
        '[CallService] stub incoming callId=$callId handle=$handle '
        'name=$displayName',
      );
    }
  }

  @override
  Future<void> startOutgoing({
    required String callId,
    required String handle,
    String? displayName,
  }) async {
    if (kDebugMode) {
      // ignore: avoid_print
      print(
        '[CallService] stub outgoing callId=$callId handle=$handle '
        'name=$displayName',
      );
    }
  }

  @override
  Future<void> endCall(String callId) async {
    if (kDebugMode) {
      // ignore: avoid_print
      print('[CallService] stub end callId=$callId');
    }
  }
}

import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';

import 'imessage_bridge.dart';
import 'sms_life_index.dart';

/// Snapshot of the optional Android SMS host (Google Messages inbox).
class SmsHostStatus {
  const SmsHostStatus({
    required this.platform,
    required this.enabled,
    required this.canRead,
    required this.canSend,
    required this.canReceive,
    required this.googleMessagesInstalled,
    required this.messageCount,
    required this.ready,
    this.error,
    this.rcsNote,
  });

  final String platform;
  final bool enabled;
  final bool canRead;
  final bool canSend;
  final bool canReceive;
  final bool googleMessagesInstalled;
  final int messageCount;
  final bool ready;
  final String? error;
  final String? rcsNote;

  bool get isSupported => platform == 'android';

  String get summary {
    if (platform != 'android') {
      return 'SMS host needs the Android app';
    }
    if (ready) {
      return 'Ready · SMS · $messageCount messages'
          '${googleMessagesInstalled ? ' · Google Messages present' : ''}';
    }
    if (error != null && error!.isNotEmpty) return error!;
    if (!canRead || !canSend) {
      return 'Grant SMS permission so agents can prompt you on this number';
    }
    if (!enabled) {
      return 'Optional — enable only if you want agents to text this phone';
    }
    return 'SMS host not ready';
  }

  factory SmsHostStatus.unsupported() => const SmsHostStatus(
        platform: 'unsupported',
        enabled: false,
        canRead: false,
        canSend: false,
        canReceive: false,
        googleMessagesInstalled: false,
        messageCount: 0,
        ready: false,
        error: 'SMS host requires the Android app',
      );

  factory SmsHostStatus.fromMap(Map<dynamic, dynamic> map) {
    final err = map['error']?.toString();
    return SmsHostStatus(
      platform: map['platform']?.toString() ?? 'android',
      enabled: map['enabled'] == true,
      canRead: map['canRead'] == true,
      canSend: map['canSend'] == true,
      canReceive: map['canReceive'] == true,
      googleMessagesInstalled: map['googleMessagesInstalled'] == true,
      messageCount: _asInt(map['messageCount']),
      ready: map['ready'] == true,
      error: (err == null || err.isEmpty) ? null : err,
      rcsNote: map['rcsNote']?.toString(),
    );
  }

  SmsHostStatus copyWith({String? error}) {
    return SmsHostStatus(
      platform: platform,
      enabled: enabled,
      canRead: canRead,
      canSend: canSend,
      canReceive: canReceive,
      googleMessagesInstalled: googleMessagesInstalled,
      messageCount: messageCount,
      ready: ready,
      error: error ?? this.error,
      rcsNote: rcsNote,
    );
  }
}

class SmsHostThread {
  const SmsHostThread({
    required this.address,
    required this.lastBody,
    required this.isFromMe,
    required this.ts,
  });

  final String address;
  final String lastBody;
  final bool isFromMe;
  final int ts;

  String get title => address;

  factory SmsHostThread.fromMap(Map<dynamic, dynamic> map) {
    return SmsHostThread(
      address: map['address']?.toString() ?? '',
      lastBody: map['lastBody']?.toString() ?? '',
      isFromMe: map['isFromMe'] == true,
      ts: _asInt(map['ts']),
    );
  }
}

/// Optional Android SMS host. Same job as the Mac iMessage host:
/// the device owner can let agents prompt them on their own number.
///
/// Uses the telephony SMS provider (what Google Messages stores for SMS).
/// RCS is not available to third-party apps.
class SmsHostBridge {
  SmsHostBridge({MethodChannel? channel, EventChannel? events})
      : _channel = channel ?? const MethodChannel('com.derozic.bevel/sms_host'),
        _events = events ??
            const EventChannel('com.derozic.bevel/sms_host_events');

  final MethodChannel _channel;
  final EventChannel _events;

  static bool get isSupportedPlatform {
    if (kIsWeb) return false;
    return Platform.isAndroid;
  }

  Stream<Map<String, dynamic>> events() {
    if (!isSupportedPlatform) return const Stream.empty();
    return _events.receiveBroadcastStream().map((raw) {
      if (raw is Map) return Map<String, dynamic>.from(raw);
      return <String, dynamic>{'type': 'unknown'};
    });
  }

  Future<SmsHostStatus> status() async {
    if (!isSupportedPlatform) return SmsHostStatus.unsupported();
    try {
      final raw = await _channel.invokeMethod<dynamic>('status');
      if (raw is! Map) return SmsHostStatus.unsupported();
      return SmsHostStatus.fromMap(raw);
    } on MissingPluginException {
      return SmsHostStatus.unsupported().copyWith(
        error: 'Native SMS channel not registered — rebuild the Android app',
      );
    } on PlatformException catch (e) {
      return SmsHostStatus.unsupported().copyWith(error: e.message ?? e.code);
    }
  }

  Future<SmsHostStatus> requestPermissions() async {
    if (!isSupportedPlatform) return SmsHostStatus.unsupported();
    try {
      await Permission.sms.request();
      final raw = await _channel.invokeMethod<dynamic>('status');
      if (raw is! Map) return SmsHostStatus.unsupported();
      return SmsHostStatus.fromMap(raw);
    } catch (e) {
      return SmsHostStatus.unsupported().copyWith(error: e.toString());
    }
  }

  Future<SmsHostStatus> setEnabled(bool enabled) async {
    if (!isSupportedPlatform) return SmsHostStatus.unsupported();
    try {
      final raw = await _channel.invokeMethod<dynamic>(
        'setEnabled',
        <String, dynamic>{'enabled': enabled},
      );
      if (raw is! Map) return SmsHostStatus.unsupported();
      return SmsHostStatus.fromMap(raw);
    } catch (e) {
      return SmsHostStatus.unsupported().copyWith(error: e.toString());
    }
  }

  Future<List<SmsHostThread>> listRecentThreads({int limit = 40}) async {
    if (!isSupportedPlatform) return const [];
    try {
      final raw = await _channel.invokeMethod<dynamic>(
        'listRecentThreads',
        <String, dynamic>{'limit': limit},
      );
      if (raw is! Map) return const [];
      final threads = raw['threads'];
      if (threads is! List) return const [];
      return threads
          .whereType<Map>()
          .map(SmsHostThread.fromMap)
          .where((t) => t.address.isNotEmpty)
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<List<SmsLifeMoment>> searchInbox(String q, {int limit = 40}) async {
    if (!isSupportedPlatform || q.trim().length < 2) return const [];
    try {
      final raw = await _channel.invokeMethod<dynamic>(
        'searchInbox',
        <String, dynamic>{'q': q.trim(), 'limit': limit},
      );
      if (raw is! Map) return const [];
      return _momentsFrom(raw['messages']);
    } catch (_) {
      return const [];
    }
  }

  /// Scan recent SMS and keep only life / critical moments.
  Future<List<SmsLifeMoment>> scanLifeMoments({int limit = 400}) async {
    if (!isSupportedPlatform) return const [];
    try {
      final raw = await _channel.invokeMethod<dynamic>(
        'scanMessages',
        <String, dynamic>{'limit': limit},
      );
      if (raw is! Map) return const [];
      final all = _momentsFrom(raw['messages']);
      return all.where((m) => m.matters).toList();
    } catch (_) {
      return const [];
    }
  }

  List<SmsLifeMoment> _momentsFrom(Object? raw) {
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((e) {
      return classifySms(
        id: e['id']?.toString() ?? '',
        address: e['address']?.toString() ?? '',
        body: e['body']?.toString() ?? '',
        ts: _asInt(e['ts']),
        isFromMe: e['isFromMe'] == true,
      );
    }).toList();
  }

  Future<IMessageSendResult> send({
    required String address,
    required String body,
  }) async {
    final normalized = normalizeIMessageAddress(address);
    if (!isSupportedPlatform) {
      return IMessageSendResult(
        ok: false,
        address: normalized,
        error: 'SMS send requires the Android app',
      );
    }
    try {
      final raw = await _channel.invokeMethod<dynamic>(
        'send',
        <String, dynamic>{'address': normalized, 'body': body},
      );
      if (raw is! Map) {
        return IMessageSendResult(
          ok: false,
          address: normalized,
          error: 'Unexpected send payload',
        );
      }
      return IMessageSendResult(
        ok: raw['ok'] == true,
        address: raw['address']?.toString() ?? normalized,
        error: raw['error']?.toString(),
        method: raw['method']?.toString(),
      );
    } on PlatformException catch (e) {
      return IMessageSendResult(
        ok: false,
        address: normalized,
        error: e.message ?? e.code,
      );
    }
  }
}

int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

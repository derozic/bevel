import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Seconds between Unix epoch and Apple's 2001-01-01 Messages date origin.
const double kAppleMessagesEpoch = 978307200;

/// Convert an Apple Messages `date` column to unix milliseconds.
///
/// Modern chat.db stores nanoseconds since 2001-01-01; older rows are seconds
/// (and a few are microseconds). Mirrors `IMessageStore.appleDateToUnixMs`.
int appleDateToUnixMs(int value) {
  final magnitude = value.abs();
  // High Sierra+ stores nanoseconds since 2001 (~1e17 today).
  // 1e12 ns == 1 second — anything larger is nanoseconds, not seconds.
  final seconds =
      magnitude >= 1000000000000 ? value / 1000000000.0 : value.toDouble();
  return ((seconds + kAppleMessagesEpoch) * 1000).round();
}

/// Normalize a phone or Apple ID for Messages / chatGuid.
///
/// Same rules as `apps/web/src/lib/bluebubbles/client.ts` `imessageAddress`.
String normalizeIMessageAddress(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return trimmed;
  if (trimmed.contains('@')) return trimmed;
  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (trimmed.startsWith('+')) return '+$digits';
  if (digits.length == 10) return '+1$digits';
  if (digits.length == 11 && digits.startsWith('1')) return '+$digits';
  return digits.isEmpty ? trimmed : '+$digits';
}

enum IMessageAccountMode { dedicated, personal }

/// Snapshot of the local Messages host on this Mac.
class IMessageHostStatus {
  const IMessageHostStatus({
    required this.platform,
    required this.accountMode,
    required this.databaseExists,
    required this.fullDiskAccess,
    required this.automationGranted,
    required this.automationStatus,
    required this.messageCount,
    required this.chatDbPath,
    required this.ready,
    this.enabled = false,
    this.apiRunning = false,
    this.apiUrl,
    this.error,
  });

  final String platform;
  final IMessageAccountMode accountMode;
  final bool enabled;
  final bool apiRunning;
  final String? apiUrl;
  final bool databaseExists;
  final bool fullDiskAccess;
  final bool automationGranted;
  final String automationStatus;
  final int messageCount;
  final String chatDbPath;
  final bool ready;
  final String? error;

  bool get isSupported => platform == 'macos';

  String get summary {
    if (platform != 'macos') {
      return 'iMessage host needs the Silicon Mac app';
    }
    if (ready) {
      final mode = accountMode == IMessageAccountMode.personal
          ? 'personal'
          : 'dedicated';
      final api = apiRunning ? ' · API ${apiUrl ?? ''}' : '';
      return 'Ready · $mode · $messageCount messages$api';
    }
    if (!enabled) {
      return 'Optional — enable if you want agents to prompt you on iMessage';
    }
    if (error != null && error!.isNotEmpty) return error!;
    if (!fullDiskAccess) return 'Grant Full Disk Access to read Messages';
    if (!automationGranted) return 'Allow BEVEL to control Messages.app';
    if (!databaseExists) return 'Sign into Messages.app on this Mac';
    return 'iMessage host not ready';
  }

  factory IMessageHostStatus.unsupported() => const IMessageHostStatus(
        platform: 'unsupported',
        accountMode: IMessageAccountMode.dedicated,
        databaseExists: false,
        fullDiskAccess: false,
        automationGranted: false,
        automationStatus: 'unsupported',
        messageCount: 0,
        chatDbPath: '',
        ready: false,
        error: 'iMessage host requires the macOS app',
      );

  factory IMessageHostStatus.fromMap(Map<dynamic, dynamic> map) {
    final modeRaw = map['accountMode']?.toString() ?? 'dedicated';
    final err = map['error']?.toString();
    return IMessageHostStatus(
      platform: map['platform']?.toString() ?? 'macos',
      accountMode: modeRaw == 'personal'
          ? IMessageAccountMode.personal
          : IMessageAccountMode.dedicated,
      enabled: map['enabled'] == true,
      apiRunning: map['apiRunning'] == true,
      apiUrl: map['apiUrl']?.toString(),
      databaseExists: map['databaseExists'] == true,
      fullDiskAccess: map['fullDiskAccess'] == true,
      automationGranted: map['automationGranted'] == true,
      automationStatus: map['automationStatus']?.toString() ?? 'unknown',
      messageCount: _asInt(map['messageCount']),
      chatDbPath: map['chatDbPath']?.toString() ?? '',
      ready: map['ready'] == true,
      error: (err == null || err.isEmpty) ? null : err,
    );
  }
}

class IMessageChatPreview {
  const IMessageChatPreview({
    required this.chatGuid,
    required this.chatIdentifier,
    required this.displayName,
    required this.handle,
    required this.lastBody,
    required this.isFromMe,
    required this.ts,
  });

  final String chatGuid;
  final String chatIdentifier;
  final String displayName;
  final String handle;
  final String lastBody;
  final bool isFromMe;
  final int ts;

  String get title {
    if (displayName.isNotEmpty) return displayName;
    if (handle.isNotEmpty) return handle;
    if (chatIdentifier.isNotEmpty) return chatIdentifier;
    return chatGuid;
  }

  factory IMessageChatPreview.fromMap(Map<dynamic, dynamic> map) {
    return IMessageChatPreview(
      chatGuid: map['chatGuid']?.toString() ?? '',
      chatIdentifier: map['chatIdentifier']?.toString() ?? '',
      displayName: map['displayName']?.toString() ?? '',
      handle: map['handle']?.toString() ?? '',
      lastBody: map['lastBody']?.toString() ?? '',
      isFromMe: map['isFromMe'] == true,
      ts: _asInt(map['ts']),
    );
  }
}

class IMessageSendResult {
  const IMessageSendResult({
    required this.ok,
    required this.address,
    this.error,
    this.method,
  });

  final bool ok;
  final String address;
  final String? error;
  final String? method;
}

/// Local iMessage host: chat.db + AppleScript via the macOS runner.
///
/// Does not talk to BlueBubbles or Firebase. Cloud ingest/outbox is a later PR.
class IMessageBridge {
  IMessageBridge({MethodChannel? channel, EventChannel? events})
      : _channel = channel ?? const MethodChannel('com.derozic.bevel/imessage'),
        _events = events ??
            const EventChannel('com.derozic.bevel/imessage_events');

  final MethodChannel _channel;
  final EventChannel _events;

  static bool get isSupportedPlatform {
    if (kIsWeb) return false;
    return Platform.isMacOS;
  }

  Stream<Map<String, dynamic>> events() {
    if (!isSupportedPlatform) return const Stream.empty();
    return _events.receiveBroadcastStream().map((raw) {
      if (raw is Map) {
        return Map<String, dynamic>.from(raw);
      }
      return <String, dynamic>{'type': 'unknown'};
    });
  }

  Future<IMessageHostStatus> status() async {
    if (!isSupportedPlatform) return IMessageHostStatus.unsupported();
    try {
      final raw = await _channel.invokeMethod<dynamic>('status');
      if (raw is! Map) return IMessageHostStatus.unsupported();
      return IMessageHostStatus.fromMap(raw);
    } on MissingPluginException {
      return IMessageHostStatus.unsupported().copyWith(
        error: 'Native iMessage channel not registered — rebuild the Silicon app',
      );
    } on PlatformException catch (e) {
      return IMessageHostStatus.unsupported().copyWith(
        error: e.message ?? e.code,
      );
    }
  }

  Future<IMessageHostStatus> requestPermissions() async {
    if (!isSupportedPlatform) return IMessageHostStatus.unsupported();
    try {
      final raw = await _channel.invokeMethod<dynamic>('requestPermissions');
      if (raw is! Map) return IMessageHostStatus.unsupported();
      return IMessageHostStatus.fromMap(raw);
    } catch (e) {
      return IMessageHostStatus.unsupported().copyWith(error: e.toString());
    }
  }

  Future<void> openPrivacyPane(String pane) async {
    if (!isSupportedPlatform) return;
    try {
      await _channel.invokeMethod<dynamic>(
        'openPrivacyPane',
        <String, dynamic>{'pane': pane},
      );
    } catch (_) {}
  }

  Future<IMessageHostStatus> setEnabled(bool enabled) async {
    if (!isSupportedPlatform) return IMessageHostStatus.unsupported();
    try {
      final raw = await _channel.invokeMethod<dynamic>(
        'setEnabled',
        <String, dynamic>{'enabled': enabled},
      );
      if (raw is! Map) return IMessageHostStatus.unsupported();
      return IMessageHostStatus.fromMap(raw);
    } catch (e) {
      return IMessageHostStatus.unsupported().copyWith(error: e.toString());
    }
  }

  Future<IMessageHostStatus> setAccountMode(IMessageAccountMode mode) async {
    if (!isSupportedPlatform) return IMessageHostStatus.unsupported();
    try {
      final raw = await _channel.invokeMethod<dynamic>(
        'setAccountMode',
        <String, dynamic>{
          'mode': mode == IMessageAccountMode.personal ? 'personal' : 'dedicated',
        },
      );
      if (raw is! Map) return IMessageHostStatus.unsupported();
      return IMessageHostStatus.fromMap(raw);
    } catch (e) {
      return IMessageHostStatus.unsupported().copyWith(error: e.toString());
    }
  }

  Future<List<IMessageChatPreview>> listRecentChats({int limit = 40}) async {
    if (!isSupportedPlatform) return const [];
    try {
      final raw = await _channel.invokeMethod<dynamic>(
        'listRecentChats',
        <String, dynamic>{'limit': limit},
      );
      if (raw is! Map) return const [];
      final chats = raw['chats'];
      if (chats is! List) return const [];
      return chats
          .whereType<Map>()
          .map((e) => IMessageChatPreview.fromMap(e))
          .where((c) => c.chatGuid.isNotEmpty)
          .toList();
    } catch (_) {
      return const [];
    }
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
        error: 'iMessage send requires the macOS app',
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

  Future<void> startWatching() async {
    if (!isSupportedPlatform) return;
    try {
      await _channel.invokeMethod<dynamic>('startWatching');
    } catch (_) {}
  }

  Future<void> stopWatching() async {
    if (!isSupportedPlatform) return;
    try {
      await _channel.invokeMethod<dynamic>('stopWatching');
    } catch (_) {}
  }
}

extension _IMessageHostStatusCopy on IMessageHostStatus {
  IMessageHostStatus copyWith({String? error}) {
    return IMessageHostStatus(
      platform: platform,
      accountMode: accountMode,
      enabled: enabled,
      apiRunning: apiRunning,
      apiUrl: apiUrl,
      databaseExists: databaseExists,
      fullDiskAccess: fullDiskAccess,
      automationGranted: automationGranted,
      automationStatus: automationStatus,
      messageCount: messageCount,
      chatDbPath: chatDbPath,
      ready: ready,
      error: error ?? this.error,
    );
  }
}

int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

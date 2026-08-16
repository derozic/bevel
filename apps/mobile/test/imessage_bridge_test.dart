import 'package:bevel_app/native/imessage_bridge.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizeIMessageAddress', () {
    test('keeps Apple ID emails', () {
      expect(normalizeIMessageAddress('  scott@derozic.com '), 'scott@derozic.com');
    });

    test('promotes 10-digit US numbers to +1', () {
      expect(normalizeIMessageAddress('(555) 123-4567'), '+15551234567');
    });

    test('keeps explicit plus and strips punctuation', () {
      expect(normalizeIMessageAddress('+1 (555) 123-4567'), '+15551234567');
    });

    test('accepts 11-digit numbers that already start with 1', () {
      expect(normalizeIMessageAddress('15551234567'), '+15551234567');
    });
  });

  group('appleDateToUnixMs', () {
    test('converts seconds since 2001-01-01', () {
      // 0 Apple seconds = 2001-01-01T00:00:00Z
      expect(appleDateToUnixMs(0), 978307200000);
    });

    test('converts nanosecond Apple dates used on modern macOS', () {
      // 1000 seconds after Apple epoch, stored as nanoseconds (1e12 ns)
      expect(appleDateToUnixMs(1000000000000), 978308200000);
    });
  });

  group('IMessageHostStatus', () {
    test('fromMap + summary when ready', () {
      final status = IMessageHostStatus.fromMap({
        'platform': 'macos',
        'accountMode': 'personal',
        'databaseExists': true,
        'fullDiskAccess': true,
        'automationGranted': true,
        'automationStatus': 'granted',
        'messageCount': 42,
        'chatDbPath': '/Users/me/Library/Messages/chat.db',
        'ready': true,
      });
      expect(status.accountMode, IMessageAccountMode.personal);
      expect(status.ready, isTrue);
      expect(status.summary, contains('Ready'));
      expect(status.summary, contains('personal'));
      expect(status.messageCount, 42);
    });

    test('stays optional until the operator enables it', () {
      final status = IMessageHostStatus.fromMap({
        'platform': 'macos',
        'accountMode': 'dedicated',
        'enabled': false,
        'ready': false,
      });
      expect(status.summary, contains('Optional'));
    });

    test('prompts for Full Disk Access first', () {
      final status = IMessageHostStatus.fromMap({
        'platform': 'macos',
        'accountMode': 'dedicated',
        'enabled': true,
        'databaseExists': true,
        'fullDiskAccess': false,
        'automationGranted': false,
        'automationStatus': 'denied',
        'messageCount': 0,
        'ready': false,
      });
      expect(status.summary, contains('Full Disk Access'));
    });
  });

  group('IMessageChatPreview', () {
    test('title prefers displayName then handle', () {
      expect(
        IMessageChatPreview.fromMap({
          'chatGuid': 'iMessage;-;+1555',
          'displayName': 'Jordan',
          'handle': '+1555',
        }).title,
        'Jordan',
      );
      expect(
        IMessageChatPreview.fromMap({
          'chatGuid': 'iMessage;-;+1555',
          'handle': '+15551234567',
        }).title,
        '+15551234567',
      );
    });
  });
}

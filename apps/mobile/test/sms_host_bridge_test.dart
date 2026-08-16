import 'package:bevel_app/native/sms_host_bridge.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SmsHostStatus', () {
    test('ready summary mentions SMS and Google Messages', () {
      final status = SmsHostStatus.fromMap({
        'platform': 'android',
        'enabled': true,
        'canRead': true,
        'canSend': true,
        'canReceive': true,
        'googleMessagesInstalled': true,
        'messageCount': 12,
        'ready': true,
      });
      expect(status.ready, isTrue);
      expect(status.summary, contains('Ready'));
      expect(status.summary, contains('Google Messages'));
    });

    test('off by default until the operator enables it', () {
      final status = SmsHostStatus.fromMap({
        'platform': 'android',
        'enabled': false,
        'canRead': true,
        'canSend': true,
        'canReceive': true,
        'googleMessagesInstalled': true,
        'messageCount': 3,
        'ready': false,
      });
      expect(status.summary, contains('Optional'));
    });

    test('asks for SMS permission before enable', () {
      final status = SmsHostStatus.fromMap({
        'platform': 'android',
        'enabled': false,
        'canRead': false,
        'canSend': false,
        'ready': false,
      });
      expect(status.summary, contains('Grant SMS'));
    });
  });

  group('SmsHostThread', () {
    test('title is the address', () {
      expect(
        SmsHostThread.fromMap({
          'address': '+15551234567',
          'lastBody': 'hello',
          'isFromMe': false,
          'ts': 1,
        }).title,
        '+15551234567',
      );
    });
  });
}

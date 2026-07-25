import 'package:bevel_app/native/deep_links.dart';
import 'package:bevel_app/native/hermes_handoff.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('HermesHandoffV1', () {
    test('clipboard roundtrip preserves expanded fields', () {
      final h = HermesHandoffV1(
        channel: 'general',
        tenant: '2x4m',
        surface: 'desktop',
        mode: 'build',
        prompt: 'Ship health probe',
        successCriteria: 'PR open',
        evidence: const ['apps/mobile/lib/native/hermes_bridge.dart'],
        fleetMessageId: 'msg_abc',
        projectPath: '/Users/me/dev/bevel',
        skills: const ['bevel-workspace'],
      ).withDefaultReturn();

      final text = h.toClipboardText();
      expect(text.startsWith(HermesHandoffV1.clipboardPrefix), isTrue);

      final back = HermesHandoffV1.tryParseClipboard(text);
      expect(back, isNotNull);
      expect(back!.channel, 'general');
      expect(back.tenant, '2x4m');
      expect(back.successCriteria, 'PR open');
      expect(back.evidence, isNotEmpty);
      expect(back.fleetMessageId, 'msg_abc');
      expect(back.projectPath, '/Users/me/dev/bevel');
      expect(back.returnUrl, contains('bevel://hermes/return'));
    });

    test('fromQuery maps surface and projectPath', () {
      final h = HermesHandoffV1.fromQuery({
        'channel': 'ops',
        'surface': 'cli',
        'cwd': '/tmp/repo',
        'prompt': 'hi',
        'successCriteria': 'done',
      });
      expect(h.channel, 'ops');
      expect(h.surface, 'cli');
      expect(h.projectPath, '/tmp/repo');
      expect(h.successCriteria, 'done');
    });
  });

  group('DeepLinkService.parse', () {
    test('hermes open', () {
      final a = DeepLinkService.parse(
        Uri.parse('bevel://hermes/open?channel=product&mode=build&prompt=hi'),
      );
      expect(a.kind, 'hermes_open');
      expect(a.channel, 'product');
      expect(a.handoff?.prompt, 'hi');
    });

    test('hermes return', () {
      final a = DeepLinkService.parse(
        Uri.parse(
          'bevel://hermes/return?channel=general&status=done&summary=ok',
        ),
      );
      expect(a.kind, 'hermes_return');
      expect(a.channel, 'general');
      expect(a.returnStatus, 'done');
      expect(a.returnSummary, 'ok');
    });

    test('hermes status', () {
      final a = DeepLinkService.parse(Uri.parse('bevel://hermes/status'));
      expect(a.kind, 'hermes_status');
    });
  });
}

import 'package:bevel_app/native/deep_links.dart';
import 'package:bevel_app/native/session_bridge.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SessionBridge', () {
    test('handoffRedeemUri uses workspace host and relative callback', () {
      final uri = SessionBridge.handoffRedeemUri(
        code: 'abc123',
        callbackPath: '/~general',
        workspaceOrigin: 'https://bevel.2x4m.cc',
      );
      expect(uri.scheme, 'https');
      expect(uri.host, 'bevel.2x4m.cc');
      expect(uri.path, '/api/auth/handoff');
      expect(uri.queryParameters['code'], 'abc123');
      expect(uri.queryParameters['callbackUrl'], '/~general');
    });

    test('handoffRedeemUri rejects open redirect paths', () {
      final uri = SessionBridge.handoffRedeemUri(
        code: 'x',
        callbackPath: 'https://evil.example/',
      );
      expect(uri.queryParameters['callbackUrl'], '/~general');
    });

    test('unwrapJsString strips iOS quotes', () {
      expect(SessionBridge.unwrapJsString('"null"'), '');
      expect(
        SessionBridge.unwrapJsString(r'{"user":{"email":"a@b.com"}}'),
        contains('a@b.com'),
      );
    });
  });

  group('DeepLink auth_complete', () {
    test('parses handoff code and workspace host', () {
      final uri = Uri.parse(
        'bevel://auth/complete?email=s@derozic.com&name=Scott'
        '&code=handoff_xyz&path=/~ops&workspaceHost=bevel.2x4m.cc&tenant=2x4m',
      );
      final action = DeepLinkService.parse(uri);
      expect(action.kind, 'auth_complete');
      expect(action.email, 's@derozic.com');
      expect(action.handoffCode, 'handoff_xyz');
      expect(action.route, '/~ops');
      expect(action.workspaceHost, 'bevel.2x4m.cc');
      expect(action.tenantSlug, '2x4m');
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bevel_app/config.dart';
import 'package:bevel_app/main.dart';
import 'package:bevel_app/native/deep_links.dart';
import 'package:bevel_app/native/media_device_discovery.dart';

void main() {
  testWidgets('BEVEL home shows workspace entry', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const BevelApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('BEVEL'), findsWidgets);
    expect(find.text('Continue with Google'), findsOneWidget);
    expect(
      find.textContaining('Open workspace'),
      findsWidgets,
    );
    expect(find.text('Native integrations'), findsOneWidget);
  });

  test('deep link routes map bevel scheme', () {
    expect(
      DeepLinkService.routeFor(Uri.parse('bevel://channel/product')),
      '/bevel/product',
    );
    expect(
      DeepLinkService.routeFor(Uri.parse('bevel://login')),
      '/login',
    );
    expect(
      DeepLinkService.routeFor(Uri.parse('bevel://auth/complete')),
      '/',
    );
    final auth = DeepLinkService.parse(Uri.parse('bevel://auth/complete?code=x'));
    expect(auth.kind, 'auth_complete');
  });

  test('OAuth hosts are detected for system browser', () {
    expect(
      BevelConfig.isOAuthNavigation(
        Uri.parse('https://accounts.google.com/o/oauth2/v2/auth'),
      ),
      isTrue,
    );
    expect(
      BevelConfig.isOAuthNavigation(
        Uri.parse('https://bevel.2x4m.lvh.me/api/auth/signin/google'),
      ),
      isTrue,
    );
    expect(
      BevelConfig.isOAuthNavigation(
        Uri.parse('https://bevel.2x4m.lvh.me/bevel'),
      ),
      isFalse,
    );
  });

  test('production host allowlist includes platform and workspace', () {
    expect(BevelConfig.isAllowedInAppHost('bevel.is'), isTrue);
    expect(BevelConfig.isAllowedInAppHost('api.bevel.is'), isTrue);
    expect(BevelConfig.isAllowedInAppHost('bevel.2x4m.cc'), isTrue);
    expect(BevelConfig.isAllowedInAppHost('realtime.bevel.is'), isTrue);
    expect(BevelConfig.isAllowedInAppHost('evil.example.com'), isFalse);
  });

  test('media device models parse inventory maps', () {
    final d = BevelMediaDevice.fromMap({
      'id': 'BuiltInMic',
      'label': 'MacBook Pro Microphone',
      'kind': 'audioinput',
      'isDefault': true,
    });
    expect(d.id, 'BuiltInMic');
    expect(d.isDefault, isTrue);
    expect(d.toJson()['kind'], 'audioinput');
  });
}

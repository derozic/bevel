import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bevel_app/config.dart';
import 'package:bevel_app/main.dart';
import 'package:bevel_app/native/deep_links.dart';

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
    // Mac vs mobile copy depends on platform under test
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
        Uri.parse('https://2x4m.bevel.lvh.me/api/auth/signin/google'),
      ),
      isTrue,
    );
    expect(
      BevelConfig.isOAuthNavigation(
        Uri.parse('https://2x4m.bevel.lvh.me/bevel'),
      ),
      isFalse,
    );
  });
}

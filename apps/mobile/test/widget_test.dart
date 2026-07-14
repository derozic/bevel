import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
  });
}

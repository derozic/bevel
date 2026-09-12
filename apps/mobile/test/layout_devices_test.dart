import 'dart:ui' show DisplayFeature, DisplayFeatureState, DisplayFeatureType;

import 'package:bevel_app/ui/layout/bevel_breakpoints.dart';
import 'package:bevel_app/ui/layout/device_catalog.dart';
import 'package:bevel_app/ui/nugget/nugget.dart';
import 'package:bevel_app/ui/nugget/nugget_stage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _host({
  required Size size,
  List<DisplayFeature> features = const [],
  required Widget child,
}) {
  return MediaQuery(
    data: MediaQueryData(size: size, displayFeatures: features),
    child: MaterialApp(home: child),
  );
}

void main() {
  testWidgets('phone class devices stay compact', (tester) async {
    for (final id in ['s26-ultra', 'iphone-17-pro-max', 'pixel-fold-cover']) {
      final device = bevelDeviceCatalog.firstWhere((d) => d.id == id);
      late BevelLayoutInfo info;
      await tester.pumpWidget(
        _host(
          size: device.size,
          features: device.hinged
              ? [
                  DisplayFeature(
                    bounds: Rect.fromLTWH(device.size.width / 2, 0, 2, device.size.height),
                    type: DisplayFeatureType.fold,
                    state: DisplayFeatureState.postureFlat,
                  ),
                ]
              : const [],
          child: Builder(
            builder: (context) {
              info = BevelLayoutInfo.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      expect(info.isCompact, isTrue, reason: device.label);
      expect(info.prefersSplit, isFalse, reason: device.label);
    }
  });

  testWidgets('tablets and fold inner prefer split / expanded', (tester) async {
    for (final id in ['ipad-pro-11', 'ipad-pro-13', 'pixel-tablet', 'pixel-fold-inner', 'apple-duo']) {
      final device = bevelDeviceCatalog.firstWhere((d) => d.id == id);
      late BevelLayoutInfo info;
      await tester.pumpWidget(
        _host(
          size: Size(device.size.longestSide, device.size.shortestSide),
          features: device.hinged
              ? [
                  DisplayFeature(
                    bounds: Rect.fromLTWH(device.size.longestSide / 2, 0, 2, device.size.shortestSide),
                    type: DisplayFeatureType.hinge,
                    state: DisplayFeatureState.postureFlat,
                  ),
                ]
              : const [],
          child: Builder(
            builder: (context) {
              info = BevelLayoutInfo.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      expect(
        info.prefersSplit || info.isExpanded || info.isFoldInner,
        isTrue,
        reason: '${device.label} size=${info.size} class=${info.layoutClass} surface=${info.surfaceMode}',
      );
    }
  });

  test('nugget related molecule parses for CMYK share', () {
    final nugget = BevelNugget.tryParse({
      'scale': 'organism',
      'source': 'cmyk',
      'title': '2x4m BrandKit shared',
      'atoms': [
        {'label': 'sink', 'value': 'kitchen sink'},
      ],
      'related': [
        {
          'scale': 'molecule',
          'source': 'cmyk',
          'title': 'Process tokens',
          'atoms': [
            {'label': 'C', 'value': '#0ea5e9'},
            {'label': 'M', 'value': '#d946ef'},
          ],
        },
      ],
    });
    expect(nugget, isNotNull);
    expect(nugget!.related.single.scale, NuggetScale.molecule);
    expect(nugget.resolvedPlacement, NuggetPlacement.thread);
    expect(
      BevelNugget.tryParse({
        'scale': 'page',
        'source': 'cmyk',
        'title': 'live',
      })!.resolvedPlacement,
      NuggetPlacement.page,
    );
  });

  test('tryParseRaw accepts bevel-nugget:v1 prefix from ingest', () {
    const raw = '''bevel-nugget:v1
{"scale":"template","source":"cmyk","title":"BrandKit partial","sections":[{"title":"Header","body":"mark"}]}''';
    final nugget = BevelNugget.tryParseRaw(raw);
    expect(nugget, isNotNull);
    expect(nugget!.scale, NuggetScale.template);
    expect(nugget.resolvedPlacement, NuggetPlacement.pane);
  });

  test('WebView JSON.stringify payload stages template without prefix', () {
    const raw =
        '{"scale":"template","source":"cmyk","title":"BrandKit partial","sections":[{"title":"Header","body":"mark"}],"related":[{"scale":"page","source":"cmyk","title":"live"}]}';
    final nugget = BevelNugget.tryParseRaw(raw);
    expect(nugget, isNotNull);
    expect(nugget!.scale, NuggetScale.template);
    expect(nugget.related.single.scale, NuggetScale.page);
    expect(nugget.related.single.resolvedPlacement, NuggetPlacement.page);
  });

  testWidgets('NuggetStage renders a template from the JS channel', (tester) async {
    const raw =
        '{"scale":"template","source":"cmyk","title":"BrandKit partial","sections":[{"title":"Header","body":"mark"}]}';
    final nugget = BevelNugget.tryParseRaw(raw)!;
    var closed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: NuggetStage(
          nugget: nugget,
          onClose: () => closed = true,
        ),
      ),
    );
    expect(find.text('BrandKit partial'), findsOneWidget);
    expect(find.textContaining('template'), findsOneWidget);
    expect(find.text('Header'), findsOneWidget);
    expect(find.text('mark'), findsOneWidget);
    await tester.tap(find.text('Close'));
    expect(closed, isTrue);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bevel_app/config.dart';
import 'package:bevel_app/main.dart';
import 'package:bevel_app/native/deep_links.dart';
import 'package:bevel_app/native/media_device_discovery.dart';
import 'package:bevel_app/native/macos_plugin_gaps.dart';
import 'package:bevel_app/native/native_login_gate.dart';
import 'package:bevel_app/ui/layout/bevel_breakpoints.dart';
import 'package:bevel_app/ui/workspace_shell.dart';

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
      find.textContaining('Choose workspace'),
      findsWidgets,
    );
    // Power-user hub is under the More menu — not a primary home CTA.
    expect(find.text('Native integrations'), findsNothing);
  });

  test('deep link routes map bevel scheme', () {
    expect(
      DeepLinkService.routeFor(Uri.parse('bevel://channel/product')),
      '/~product',
    );
    expect(
      DeepLinkService.routeFor(Uri.parse('bevel://timeline')),
      '/timeline',
    );
    expect(
      DeepLinkService.routeFor(Uri.parse('bevel://talk/hermes')),
      '/talk/hermes',
    );
    expect(
      DeepLinkService.routeFor(Uri.parse('bevel://login')),
      '/login',
    );
    expect(
      DeepLinkService.routeFor(Uri.parse('bevel://auth/complete')),
      '/~general',
    );
    final auth = DeepLinkService.parse(Uri.parse('bevel://auth/complete?code=x'));
    expect(auth.kind, 'auth_complete');
    expect(auth.handoffCode, 'x');
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
      isFalse,
    );
    expect(
      BevelConfig.isOAuthNavigation(
        Uri.parse('https://bevel.is/api/auth/native-complete'),
      ),
      isFalse,
    );
    expect(
      BevelConfig.isOAuthNavigation(
        Uri.parse('https://bevel.2x4m.lvh.me/bevel'),
      ),
      isFalse,
    );
    // Handoff redeem must stay inside WebView (cookie plant).
    expect(
      BevelConfig.isOAuthNavigation(
        Uri.parse('https://bevel.2x4m.cc/api/auth/handoff?code=x'),
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

  test('iPad Pro 13 gets a 320pt sidebar', () {
    const info = BevelLayoutInfo(
      layoutClass: BevelLayoutClass.expanded,
      surfaceMode: BevelSurfaceMode.flat,
      size: Size(1376, 1032),
      shortestSide: 1032,
      longestSide: 1376,
      isLandscape: true,
      hasHinge: false,
      safePadding: EdgeInsets.zero,
    );
    expect(info.isIpadPro13, isTrue);
    expect(info.prefersSplit, isTrue);
    expect(info.sidebarWidth, 320);
  });

  test('developer mode remaps apex and 2x4m hosts onto lvh.me', () {
    BevelConfig.developerMode.value = false;
    expect(BevelConfig.baseUrl, 'https://bevel.is');
    expect(BevelConfig.remapHost('bevel.2x4m.lvh.me'), 'bevel.2x4m.cc');
    expect(BevelConfig.remapHost('bevel.lvh.me'), 'bevel.is');
    expect(BevelConfig.isApexHost('bevel.is'), isTrue);
    expect(BevelConfig.isApexHost('bevel.lvh.me'), isTrue);

    BevelConfig.developerMode.value = true;
    addTearDown(() => BevelConfig.developerMode.value = false);
    expect(BevelConfig.baseUrl, 'https://bevel.lvh.me');
    expect(BevelConfig.workspaceUrl, 'https://bevel.2x4m.lvh.me');
    expect(BevelConfig.apiBaseUrl, 'https://api.bevel.lvh.me');
    expect(BevelConfig.remapHost('bevel.is'), 'bevel.lvh.me');
    expect(BevelConfig.remapHost('bevel.2x4m.cc'), 'bevel.2x4m.lvh.me');
    expect(BevelConfig.systemBrowserLoginUri().host, 'bevel.lvh.me');
    expect(BevelConfig.isProduction, isFalse);
  });

  test('WebView background color is skipped on macOS', () {
    expect(webViewSupportsBackgroundColor(TargetPlatform.macOS), isFalse);
    expect(webViewSupportsBackgroundColor(TargetPlatform.windows), isFalse);
    expect(webViewSupportsBackgroundColor(TargetPlatform.iOS), isTrue);
    expect(webViewSupportsBackgroundColor(TargetPlatform.android), isTrue);
  });

  test('native login gate allows only one browser hop', () {
    NativeLoginGate.reset();
    expect(NativeLoginGate.tryBegin(), isTrue);
    expect(NativeLoginGate.tryBegin(), isFalse);
    NativeLoginGate.markComplete();
    expect(NativeLoginGate.tryBegin(), isFalse);
    NativeLoginGate.reset();
    expect(NativeLoginGate.tryBegin(), isTrue);
    NativeLoginGate.reset();
  });

  test('macOS WebKit opaque gap is recognized', () {
    expect(
      isMacosWebKitGap(UnimplementedError('opaque is not implemented on macOS')),
      isTrue,
    );
    expect(isMacosWebKitGap(StateError('nope')), isFalse);
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

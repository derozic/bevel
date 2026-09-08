import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Flutter's WKWebView macOS plugin throws when anything touches `opaque`,
/// `backgroundColor`, or `scrollView`. Debug mode turns that into the red
/// error screen even when the page itself is fine.
bool isMacosWebKitGap(Object error) {
  if (error is! UnimplementedError) return false;
  final s = error.toString();
  return s.contains('opaque is not implemented on macOS') ||
      s.contains('backgroundColor is not implemented on macOS') ||
      s.contains('scrollView is not implemented on macOS');
}

void installMacosPluginGuards() {
  final previous = FlutterError.onError;
  FlutterError.onError = (details) {
    if (isMacosWebKitGap(details.exception)) {
      debugPrint('Ignored WebKit macOS gap: ${details.exception}');
      return;
    }
    (previous ?? FlutterError.presentError)(details);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    if (isMacosWebKitGap(error)) {
      debugPrint('Ignored WebKit macOS gap: $error');
      return true;
    }
    return false;
  };

  final previousErrorWidget = ErrorWidget.builder;
  ErrorWidget.builder = (details) {
    if (isMacosWebKitGap(details.exception)) {
      return const SizedBox.shrink();
    }
    return previousErrorWidget(details);
  };
}

import 'dart:async';

import 'package:app_links/app_links.dart';

/// Universal Links / App Links + custom scheme (`bevel://`).
class DeepLinkService {
  DeepLinkService({AppLinks? appLinks}) : _appLinks = appLinks ?? AppLinks();

  final AppLinks _appLinks;
  StreamSubscription<Uri>? _sub;

  /// Cold-start link (if the app was opened from a URL).
  Future<Uri?> get initialLink async {
    try {
      return await _appLinks.getInitialLink();
    } catch (_) {
      return null;
    }
  }

  /// Live stream of inbound links while the app is running.
  Stream<Uri> get uriLinkStream => _appLinks.uriLinkStream;

  Future<void> listen(void Function(Uri uri) onLink) async {
    await _sub?.cancel();
    final initial = await initialLink;
    if (initial != null) onLink(initial);
    _sub = uriLinkStream.listen(onLink);
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
  }

  /// Map bevel://channel/product → app path.
  static String? routeFor(Uri uri) {
    if (uri.scheme == 'bevel') {
      final host = uri.host;
      final path = uri.path;
      if (host == 'channel' || path.startsWith('/channel')) {
        final id = host == 'channel'
            ? uri.pathSegments.firstOrNull
            : uri.pathSegments.skip(1).firstOrNull;
        return id == null ? '/bevel' : '/bevel/$id';
      }
      // After system-browser OAuth — reopen workspace shell at home.
      if (host == 'auth' || path.startsWith('/auth')) {
        return '/';
      }
      if (host == 'login' || path == '/login') return '/login';
      return '/';
    }
    // https://*.bevel… /channel/…
    if (uri.pathSegments.isNotEmpty && uri.pathSegments.first == 'bevel') {
      return uri.path;
    }
    return uri.path.isEmpty ? '/' : uri.path;
  }
}

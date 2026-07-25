import 'dart:async';

import 'package:app_links/app_links.dart';

import 'hermes_handoff.dart';

/// Parsed deep-link action for the BEVEL native client.
class BevelDeepLinkAction {
  const BevelDeepLinkAction({
    required this.kind,
    this.route,
    this.channel,
    this.handoff,
    this.returnStatus,
    this.returnSummary,
    required this.raw,
  });

  /// navigate | hermes_open | hermes_return | hermes_status
  final String kind;
  final String? route;
  final String? channel;
  final HermesHandoffV1? handoff;
  final String? returnStatus;
  final String? returnSummary;
  final Uri raw;
}

/// Universal Links / App Links + custom scheme (`bevel://`).
///
/// Hermes interop routes (see agents INTEROP.md):
/// - bevel://hermes/open?...
/// - bevel://hermes/return?...
/// - bevel://hermes/status
/// - bevel://agent/hermes
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

  /// Full action parse (preferred for Hermes-aware routing).
  static BevelDeepLinkAction parse(Uri uri) {
    if (uri.scheme == 'bevel') {
      final host = uri.host.toLowerCase();
      final segs = uri.pathSegments;

      // bevel://hermes/... or bevel:///hermes/...
      final hermesPath = host == 'hermes' ||
          (segs.isNotEmpty && segs.first.toLowerCase() == 'hermes');
      if (hermesPath) {
        final action = host == 'hermes'
            ? (segs.isNotEmpty ? segs.first.toLowerCase() : 'status')
            : (segs.length > 1 ? segs[1].toLowerCase() : 'status');
        final q = uri.queryParameters;

        if (action == 'open') {
          final handoff = HermesHandoffV1.fromQuery(q).withDefaultReturn();
          final channel = handoff.channel;
          return BevelDeepLinkAction(
            kind: 'hermes_open',
            route: channel == null ? '/bevel' : '/bevel/$channel',
            channel: channel,
            handoff: handoff,
            raw: uri,
          );
        }
        if (action == 'return') {
          final channel = q['channel'];
          return BevelDeepLinkAction(
            kind: 'hermes_return',
            route: channel == null ? '/' : '/bevel/$channel',
            channel: channel,
            returnStatus: q['status'] ?? 'done',
            returnSummary: q['summary'],
            raw: uri,
          );
        }
        // status / default
        return BevelDeepLinkAction(
          kind: 'hermes_status',
          route: '/native-hub',
          raw: uri,
        );
      }

      // bevel://agent/hermes
      if (host == 'agent' || (segs.isNotEmpty && segs.first == 'agent')) {
        final agent = host == 'agent'
            ? (segs.isNotEmpty ? segs.first : '')
            : (segs.length > 1 ? segs[1] : '');
        if (agent.toLowerCase() == 'hermes') {
          return BevelDeepLinkAction(
            kind: 'hermes_open',
            route: '/bevel',
            handoff: HermesHandoffV1(
              source: 'bevel',
              target: 'hermes-desktop',
              mode: 'orchestrate',
              prompt: 'Open fleet Hermes context from BEVEL deep link',
            ).withDefaultReturn(),
            raw: uri,
          );
        }
      }

      if (host == 'channel' || uri.path.startsWith('/channel')) {
        final id = host == 'channel'
            ? uri.pathSegments.firstOrNull
            : uri.pathSegments.skip(1).firstOrNull;
        return BevelDeepLinkAction(
          kind: 'navigate',
          route: id == null ? '/bevel' : '/bevel/$id',
          channel: id,
          raw: uri,
        );
      }
      // bevel://auth/complete?code=… — return from system-browser OAuth.
      if (host == 'auth' || uri.path.startsWith('/auth')) {
        final segs = uri.pathSegments;
        final action = host == 'auth'
            ? (segs.isNotEmpty ? segs.first.toLowerCase() : 'complete')
            : (segs.length > 1 ? segs[1].toLowerCase() : 'complete');
        if (action == 'complete' || action == 'callback') {
          return BevelDeepLinkAction(
            kind: 'auth_complete',
            route: '/',
            raw: uri,
          );
        }
        return BevelDeepLinkAction(kind: 'navigate', route: '/', raw: uri);
      }
      if (host == 'login' || uri.path == '/login') {
        return BevelDeepLinkAction(kind: 'navigate', route: '/login', raw: uri);
      }
      return BevelDeepLinkAction(kind: 'navigate', route: '/', raw: uri);
    }

    // https://*.bevel… /channel/…
    if (uri.pathSegments.isNotEmpty && uri.pathSegments.first == 'bevel') {
      return BevelDeepLinkAction(
        kind: 'navigate',
        route: uri.path,
        channel: uri.pathSegments.length > 1 ? uri.pathSegments[1] : null,
        raw: uri,
      );
    }
    return BevelDeepLinkAction(
      kind: 'navigate',
      route: uri.path.isEmpty ? '/' : uri.path,
      raw: uri,
    );
  }

  /// Map bevel://channel/product → app path (legacy helper).
  static String? routeFor(Uri uri) => parse(uri).route;
}

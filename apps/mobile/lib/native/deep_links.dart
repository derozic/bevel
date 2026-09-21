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
    this.email,
    this.userId,
    this.userName,
    this.handoffCode,
    this.workspaceHost,
    this.tenantSlug,
    required this.raw,
  });

  /// navigate | hermes_open | hermes_return | hermes_status | auth_complete
  final String kind;
  final String? route;
  final String? channel;
  final HermesHandoffV1? handoff;
  final String? returnStatus;
  final String? returnSummary;
  final String? email;
  final String? userId;
  final String? userName;
  /// One-time FastAPI handoff code — redeem in WebView on workspace host.
  final String? handoffCode;
  /// Optional workspace host hint from native-complete (e.g. bevel.2x4m.cc).
  final String? workspaceHost;
  final String? tenantSlug;
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
      // Do not treat bevel://talk/hermes as Hermes Desktop (host is "talk").
      final hermesPath = host == 'hermes' ||
          ((host.isEmpty || host == 'localhost') &&
              segs.isNotEmpty &&
              segs.first.toLowerCase() == 'hermes');
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
            route: channel == null || channel.isEmpty
                ? '/~general'
                : '/~${channel.toLowerCase()}',
            channel: channel,
            handoff: handoff,
            raw: uri,
          );
        }
        if (action == 'return') {
          final channel = q['channel'];
          return BevelDeepLinkAction(
            kind: 'hermes_return',
            route: channel == null || channel.isEmpty
                ? '/~general'
                : '/~${channel.toLowerCase()}',
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
            ? (uri.pathSegments.isNotEmpty ? uri.pathSegments.first : null)
            : (uri.pathSegments.length > 1 ? uri.pathSegments[1] : null);
        final slug = id?.toLowerCase();
        return BevelDeepLinkAction(
          kind: 'navigate',
          route: slug == null || slug.isEmpty
              ? '/~general'
              : '/~$slug${querySuffix(uri)}',
          channel: slug,
          raw: uri,
        );
      }
      // bevel://timeline
      if (host == 'timeline' || uri.path.startsWith('/timeline')) {
        return BevelDeepLinkAction(
          kind: 'navigate',
          route: '/timeline',
          raw: uri,
        );
      }
      // bevel://talk/hermes
      if (host == 'talk' ||
          (uri.pathSegments.isNotEmpty && uri.pathSegments.first == 'talk')) {
        final agent = host == 'talk'
            ? (uri.pathSegments.isNotEmpty ? uri.pathSegments.first : 'hermes')
            : (uri.pathSegments.length > 1
                ? uri.pathSegments[1]
                : 'hermes');
        return BevelDeepLinkAction(
          kind: 'navigate',
          route: '/talk/${agent.toLowerCase()}${querySuffix(uri)}',
          raw: uri,
        );
      }
      // bevel://me — private agents (ChatGPT / Claude / Grok)
      if (host == 'me' || uri.path == '/me' || uri.path.startsWith('/me/')) {
        return BevelDeepLinkAction(
          kind: 'navigate',
          route: '/me${querySuffix(uri)}',
          raw: uri,
        );
      }
      // bevel://session/{id}?msg=
      if (host == 'session' || uri.path.startsWith('/session')) {
        final id = host == 'session'
            ? (uri.pathSegments.isNotEmpty ? uri.pathSegments.first : '')
            : (uri.pathSegments.length > 1 ? uri.pathSegments[1] : '');
        final route = id.isEmpty
            ? '/me'
            : '/session/$id${querySuffix(uri)}';
        return BevelDeepLinkAction(
          kind: 'navigate',
          route: route,
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
          final q = uri.queryParameters;
          final path = q['path'];
          final code = q['code']?.trim();
          return BevelDeepLinkAction(
            kind: 'auth_complete',
            route: (path != null && path.isNotEmpty) ? path : '/~general',
            email: q['email'],
            userId: q['userId'] ?? q['user_id'],
            userName: q['name'],
            handoffCode: (code != null && code.isNotEmpty) ? code : null,
            workspaceHost: q['workspaceHost'] ?? q['workspace_host'],
            tenantSlug: q['tenant'],
            raw: uri,
          );
        }
        return BevelDeepLinkAction(kind: 'navigate', route: '/', raw: uri);
      }
      if (host == 'login' || uri.path == '/login') {
        return BevelDeepLinkAction(kind: 'navigate', route: '/login', raw: uri);
      }
      // bevel:///~general?msg=  ·  bevel:///talk/claude  ·  bevel://open/~general
      if (host.isEmpty || host == 'localhost' || host == 'open') {
        final path = uri.path.isEmpty ? '/' : uri.path;
        if (path != '/') {
          return BevelDeepLinkAction(
            kind: 'navigate',
            route: pathAndQuery(uri),
            channel: channelFromPath(path),
            raw: uri,
          );
        }
      }
      return BevelDeepLinkAction(kind: 'navigate', route: '/', raw: uri);
    }

    // https://bevel.is/~general?msg=  ·  https://bevel.is/talk/claude
    final host = isBevelHttpHost(uri.host) ? uri.host.toLowerCase() : null;
    if (uri.pathSegments.isNotEmpty && uri.pathSegments.first == 'bevel') {
      final rest = uri.pathSegments.length > 1 ? uri.pathSegments[1] : '';
      final mapped = rest == 'talk' || rest == 'session' || rest == 'me'
          ? '/${uri.pathSegments.skip(1).join('/')}${querySuffix(uri)}'
          : pathAndQuery(uri);
      return BevelDeepLinkAction(
        kind: 'navigate',
        route: mapped,
        channel: channelFromPath(uri.path),
        workspaceHost: host,
        raw: uri,
      );
    }
    return BevelDeepLinkAction(
      kind: 'navigate',
      route: pathAndQuery(uri),
      channel: channelFromPath(uri.path),
      workspaceHost: host,
      raw: uri,
    );
  }

  /// Production and preview hosts that Universal Links / App Links may open.
  static bool isBevelHttpHost(String host) {
    final h = host.toLowerCase().split(':').first;
    if (h.isEmpty) return false;
    if (h == 'bevel.is' || h == 'www.bevel.is' || h == 'app.bevel.is') {
      return true;
    }
    if (h.endsWith('.bevel.is')) return true;
    if (h.contains('bevel') &&
        (h.endsWith('.2x4m.cc') || h.endsWith('.lvh.me'))) {
      return true;
    }
    return false;
  }

  static String querySuffix(Uri uri) => uri.hasQuery ? '?${uri.query}' : '';

  static String pathAndQuery(Uri uri) {
    final path = uri.path.isEmpty ? '/' : uri.path;
    return '$path${querySuffix(uri)}';
  }

  /// Channel slug from `/~general`, `/^ops`, `/bevel/c/product`.
  static String? channelFromPath(String path) {
    final segs = path.split('/').where((s) => s.isNotEmpty).toList();
    if (segs.isEmpty) return null;
    var first = segs.first;
    if (first == 'bevel' && segs.length > 1) {
      first = segs[1];
      if (first == 'c' && segs.length > 2) first = segs[2];
      if (first == 'talk' || first == 'session' || first == 'me') return null;
    }
    if (first.startsWith('~') || first.startsWith('^')) {
      final slug = first.substring(1);
      return slug.isEmpty ? null : slug.toLowerCase();
    }
    return null;
  }

  /// Map bevel://channel/product → app path (legacy helper).
  static String? routeFor(Uri uri) => parse(uri).route;
}

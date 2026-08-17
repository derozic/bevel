import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../config.dart';
import '../theme/theme.dart';
import '../native/hermes_bridge.dart';
import '../native/google_native_auth.dart';
import '../native/oauth_browser.dart';
import '../native/session_bridge.dart';
import '../native/sharing_service.dart';
import 'channel_picker_sheet.dart';
import 'gesture_haptics.dart';
import 'layout/bevel_breakpoints.dart';
import 'layout/workspace_rail.dart';

/// In-app workspace browser (WKWebView on macOS / iOS, WebView on Android).
///
/// Consumer chat shell: WebView hosts FleetChat for parity with web. Flutter
/// adds auth handoff, channel switcher (phone sheet / tablet rail), and keeps
/// operator console destinations in the system browser.
///
/// Auth: when [handoffCode] is set, loads workspace `/api/auth/handoff` first so
/// Auth.js cookies land in the WebView jar (Safari cookies are never shared).

/// WKWebView's `setBackgroundColor` sets the `opaque` property, which Flutter's
/// macOS plugin does not implement (`UnimplementedError: opaque is not
/// implemented on macOS`). iOS / Android are fine.
@visibleForTesting
bool webViewSupportsBackgroundColor([TargetPlatform? platform]) {
  final p = platform ?? defaultTargetPlatform;
  return p == TargetPlatform.iOS || p == TargetPlatform.android;
}

class WorkspaceShellPage extends StatefulWidget {
  const WorkspaceShellPage({
    super.key,
    this.initialPath = '/~general',
    this.handoffCode,
    this.workspaceHost,
    this.workspaceLabel,
    this.hermes,
    this.onOpenNativeHub,
    this.onOpenNotifications,
    this.onSwitchWorkspace,
    this.onSessionState,
    this.onPathChanged,
    this.consumerMode = true,
  });

  final String initialPath;
  /// One-time handoff code from `bevel://auth/complete?code=…`.
  final String? handoffCode;
  /// Optional host override (e.g. bevel.2x4m.cc) from native-complete.
  final String? workspaceHost;
  /// Display name for app bar (Private / 2x4m).
  final String? workspaceLabel;
  final HermesBridge? hermes;
  final VoidCallback? onOpenNativeHub;
  final VoidCallback? onOpenNotifications;
  /// Open chooser to switch Private vs product workspace.
  final VoidCallback? onSwitchWorkspace;
  /// Called after session probe (authenticated or not).
  final void Function(bool healthy, String? email)? onSessionState;
  /// Persist last workspace path for relaunch restore.
  final void Function(String path)? onPathChanged;
  /// Hide power-user chrome (Hermes desktop, native hub) from the main bar.
  final bool consumerMode;

  @override
  State<WorkspaceShellPage> createState() => _WorkspaceShellPageState();
}

class _WorkspaceShellPageState extends State<WorkspaceShellPage> {
  late final WebViewController _controller;
  final _sharing = const SharingService();
  final _oauth = const OAuthBrowser();
  final _googleNative = GoogleNativeAuth();
  var _loading = true;
  var _progress = 0;
  String? _title;
  String? _error;
  Uri? _currentUri;
  var _sessionChecked = false;
  var _sessionHealthy = false;
  var _authRetryUsed = false;
  var _needsWorkspaceSignIn = false;
  var _browserLoginInFlight = false;
  List<(String, String)> _channels = const [
    ('general', 'General'),
    ('ops', 'Ops'),
    ('product', 'Product'),
  ];

  String get _callbackPath {
    final p = widget.initialPath.trim();
    if (p.isEmpty) return '/~general';
    if (p.startsWith('/') && !p.startsWith('//')) return p;
    return '/$p';
  }

  String? get _workspaceOrigin {
    final host = widget.workspaceHost?.trim();
    if (host == null || host.isEmpty) return null;
    return 'https://$host';
  }

  Uri _startUri() {
    final code = widget.handoffCode?.trim();
    if (code != null && code.isNotEmpty) {
      return SessionBridge.handoffRedeemUri(
        code: code,
        callbackPath: _callbackPath,
        workspaceOrigin: _workspaceOrigin,
      );
    }
    final origin = _workspaceOrigin;
    if (origin != null) {
      final base = Uri.parse(origin);
      return base.replace(path: _callbackPath);
    }
    return BevelConfig.workspaceUri(_callbackPath);
  }

  @override
  void initState() {
    super.initState();
    final start = _startUri();
    _currentUri = start;

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent(
        'Mozilla/5.0 (Mobile; BevelNative/${BevelConfig.versionLabel}) '
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 '
        'BevelNative/${BevelConfig.versionLabel}',
      )
      ..addJavaScriptChannel(
        'BevelHaptics',
        onMessageReceived: (msg) {
          unawaited(playGestureHaptic(msg.message));
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (p) {
            if (!mounted) return;
            setState(() => _progress = p);
          },
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() {
              _loading = true;
              _error = null;
            });
          },
          onPageFinished: (url) async {
            final title = await _controller.getTitle();
            if (!mounted) return;
            final uri = Uri.tryParse(url) ?? _currentUri;
            setState(() {
              _loading = false;
              _title = title;
              _currentUri = uri;
            });
            if (uri != null) {
              final path = uri.path.isEmpty ? '/' : uri.path;
              // Don't persist the handoff intermediate path
              if (!path.contains('/api/auth/handoff')) {
                widget.onPathChanged?.call(path);
              }
            }
            // Mark page as native shell + tighten layout for chat.
            unawaited(
              _controller.runJavaScript(SessionBridge.injectNativeChromeJs),
            );
            // After leaving handoff (or direct load), probe session once.
            if (!_sessionChecked &&
                uri != null &&
                !uri.path.contains('/api/auth/handoff')) {
              unawaited(_probeSessionAndChannels());
            } else if (_sessionHealthy) {
              unawaited(_refreshChannelsFromWebView());
            }
          },
          onWebResourceError: (err) {
            if (!mounted) return;
            setState(() {
              _loading = false;
              _error = err.description;
            });
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;
            final path = uri.path.toLowerCase();
            // Handoff redeem must stay in WebView (plants cookies).
            if (path.contains('/api/auth/handoff')) {
              return NavigationDecision.navigate;
            }
            // Do not load the web login wall in the shell — that restarts
            // Google in the system browser and loops.
            if (path == '/login' || path.startsWith('/login/')) {
              if (mounted) {
                setState(() {
                  _needsWorkspaceSignIn = true;
                  _sessionHealthy = false;
                  _loading = false;
                });
              }
              return NavigationDecision.prevent;
            }
            // Operator console / integrations stay in system browser.
            if (SessionBridge.isOperatorPath(path) ||
                path.contains('/console')) {
              launchUrl(uri, mode: LaunchMode.externalApplication);
              if (mounted) {
                BevelSnack.show(
                  context,
                  'Console and integrations open in the browser — this app is for chat.',
                );
              }
              return NavigationDecision.prevent;
            }
            // Google/GitHub/Auth.js IdP hops leave the WebView.
            if (BevelConfig.isOAuthNavigation(uri)) {
              _oauth.open(uri);
              return NavigationDecision.prevent;
            }
            if (BevelConfig.isAllowedInAppUri(uri)) {
              return NavigationDecision.navigate;
            }
            launchUrl(uri, mode: LaunchMode.externalApplication);
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(start);
  }

  Future<void> _probeSessionAndChannels() async {
    _sessionChecked = true;
    try {
      final raw = await _controller.runJavaScriptReturningResult(
        SessionBridge.sessionProbeJs,
      );
      final jsonStr = SessionBridge.unwrapJsString(raw);
      var healthy = false;
      String? email;
      if (jsonStr.isNotEmpty && jsonStr != 'null') {
        try {
          final map = jsonDecode(jsonStr) as Map<String, dynamic>?;
          final user = map?['user'] as Map<String, dynamic>?;
          email = user?['email'] as String?;
          healthy = email != null && email.isNotEmpty;
        } catch (_) {
          healthy = false;
        }
      }

      if (!mounted) return;
      setState(() => _sessionHealthy = healthy);
      widget.onSessionState?.call(healthy, email);

      if (!healthy && !_authRetryUsed) {
        _authRetryUsed = true;
        if (mounted) {
          setState(() => _needsWorkspaceSignIn = true);
        }
        return;
      }

      if (healthy) {
        await _refreshChannelsFromWebView();
      }
    } catch (_) {
      widget.onSessionState?.call(false, null);
    }
  }

  Future<void> _refreshChannelsFromWebView() async {
    try {
      final raw = await _controller.runJavaScriptReturningResult(
        SessionBridge.listChannelsJs,
      );
      final jsonStr = SessionBridge.unwrapJsString(raw);
      if (jsonStr.isEmpty) return;
      final list = jsonDecode(jsonStr);
      if (list is! List || list.isEmpty) return;
      final next = <(String, String)>[];
      for (final item in list) {
        if (item is Map) {
          final slug = (item['slug'] ?? item['id'] ?? '').toString();
          final name = (item['name'] ?? slug).toString();
          if (slug.isNotEmpty) next.add((slug, name));
        }
      }
      if (next.isNotEmpty && mounted) {
        setState(() => _channels = next);
      }
    } catch (_) {
      /* keep defaults */
    }
  }

  Future<void> _reload() => _controller.reload();

  /// In-app Google Sign-In → handoff redeem on this host (no Safari).
  Future<void> _nativeGoogleThenReload() async {
    if (_browserLoginInFlight) return;
    _browserLoginInFlight = true;
    try {
      final host = widget.workspaceHost?.trim().isNotEmpty == true
          ? widget.workspaceHost!.trim()
          : Uri.parse(BevelConfig.workspaceUrl).host;
      final path = _callbackPath;
      final tenant = host.contains('2x4m')
          ? '2x4m'
          : host.split('.').firstWhere(
                (s) => s != 'bevel' && s.isNotEmpty,
                orElse: () => '2x4m',
              );
      final result = await _googleNative.signIn(
        tenantSlug: tenant,
        callbackPath: path,
        workspaceHost: host,
      );
      if (result == null) return;
      final redeem = SessionBridge.handoffRedeemUri(
        code: result.handoffCode,
        callbackPath: result.callbackPath ?? path,
        workspaceOrigin: 'https://$host',
      );
      await _controller.loadRequest(redeem);
      _sessionChecked = false;
      _needsWorkspaceSignIn = false;
    } catch (e) {
      if (mounted) {
        BevelSnack.show(
          context,
          'Opening Google in the browser — come back here after it finishes.',
        );
      }
      await _oauth.openSystemLogin();
    } finally {
      _browserLoginInFlight = false;
    }
  }

  Future<void> _goHome() {
    final origin = _workspaceOrigin;
    if (origin != null) {
      return _controller
          .loadRequest(Uri.parse(origin).replace(path: '/~general'));
    }
    return _controller.loadRequest(BevelConfig.workspaceUri('/~general'));
  }

  Future<void> _navigatePath(String path) {
    final origin = _workspaceOrigin;
    if (origin != null) {
      final base = Uri.parse(origin);
      return _controller.loadRequest(base.replace(path: path));
    }
    return _controller.loadRequest(BevelConfig.workspaceUri(path));
  }

  Future<void> _openChannelPicker() {
    return ChannelPickerSheet.show(
      context,
      channels: _channels,
      activePath: _currentUri?.path ?? widget.initialPath,
      onSelectPath: _navigatePath,
      onOpenTimeline: () => _navigatePath('/timeline'),
      onOpenNotifications: widget.onOpenNotifications,
    );
  }

  Future<void> _share() async {
    final uri = _currentUri ?? BevelConfig.workspaceUri();
    await _sharing.shareWorkspace(
      title: _title ?? BevelConfig.appName,
      text: 'Open in ${BevelConfig.appName}',
      uri: uri,
    );
  }

  Future<void> _openExternal() async {
    final uri = _currentUri ?? BevelConfig.workspaceUri();
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openHermes() async {
    final bridge = widget.hermes;
    if (bridge == null) return;
    final uri = _currentUri ?? BevelConfig.workspaceUri();
    final channel = _channelFromUri(uri);
    final tenant = _tenantFromHost(uri.host);
    final handoff = bridge
        .handoffForWorkspace(
          workspaceUrl: uri.toString(),
          channel: channel,
          tenant: tenant,
          mode: 'build',
          surface: 'desktop',
          projectPath: null,
          prompt:
              'Continue work from BEVEL workspace: ${uri.toString()}'
              '${channel != null ? ' (channel ~$channel)' : ''}'
              '${tenant != null ? ' tenant=$tenant' : ''}. '
              'Use skill bevel-workspace. When done: open returnUrl '
              '(bevel://hermes/return) with a short status summary.',
        )
        .copyWith(
          successCriteria:
              'Return to BEVEL channel with status + evidence; no secrets in chat',
        );
    final result = await bridge.openWithHandoff(handoff);
    if (!mounted) return;
    BevelSnack.show(context, result.message);
  }

  /// Support /~{slug}, /^{slug}, and /bevel/c/{slug}.
  static String? _channelFromUri(Uri uri) {
    final path = uri.path;
    if (path.startsWith('/bevel/c/')) {
      final rest = path.substring('/bevel/c/'.length);
      final slug =
          rest.split('/').firstWhere((s) => s.isNotEmpty, orElse: () => '');
      return slug.isEmpty ? null : slug;
    }
    if (path.startsWith('/bevel/')) {
      final rest = path.substring('/bevel/'.length);
      final slug =
          rest.split('/').firstWhere((s) => s.isNotEmpty, orElse: () => '');
      if (slug.isEmpty || slug == 'talk' || slug == 'session') return null;
      return slug;
    }
    final segs = path.split('/').where((s) => s.isNotEmpty).toList();
    if (segs.isNotEmpty) {
      final first = segs.first;
      if (first.startsWith('~') || first.startsWith('^')) {
        final slug = first.substring(1);
        return slug.isEmpty ? null : slug;
      }
    }
    if (uri.fragment.startsWith('~') || uri.fragment.startsWith('^')) {
      return uri.fragment.substring(1);
    }
    return null;
  }

  static String? _tenantFromHost(String host) {
    final h = host.toLowerCase();
    if (h.contains('2x4m')) return '2x4m';
    if (h.startsWith('bevel.') && h.endsWith('.lvh.me')) {
      final mid = h.substring('bevel.'.length, h.length - '.lvh.me'.length);
      if (mid.isNotEmpty && !mid.contains('.')) return mid;
    }
    final parts = h.split('.');
    if (parts.length >= 3 && parts[1] == 'bevel') {
      return parts[0];
    }
    return null;
  }

  String get _channelLabel {
    final uri = _currentUri;
    if (uri == null) return 'Chat';
    final ch = _channelFromUri(uri);
    if (ch != null) return '~$ch';
    final path = uri.path;
    if (path.startsWith('/talk/')) {
      final parts = path.split('/').where((s) => s.isNotEmpty).toList();
      final id = parts.length > 1 ? parts[1] : null;
      return id != null ? 'talk/$id' : 'Talk';
    }
    if (path.startsWith('/timeline')) return 'Timeline';
    if (path == '/me' || path.startsWith('/me/')) return 'Private';
    return _title?.isNotEmpty == true ? _title! : 'Workspace';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final hermes = widget.hermes;
    final layout = BevelLayoutInfo.of(context);
    final path = _currentUri?.path ?? widget.initialPath;
    final showRail = layout.prefersSplit ||
        (layout.isFoldInner &&
            layout.isLandscape &&
            layout.size.width >= 700);
    final showPhonePicker = !showRail;

    final spaceLabel = [
      if (widget.workspaceLabel != null && widget.workspaceLabel!.isNotEmpty)
        widget.workspaceLabel!,
      if (!_sessionHealthy) 'Sign in to continue',
    ].join(' · ');

    final signInBanner = _needsWorkspaceSignIn && !_sessionHealthy
        ? Material(
            color: p.surface,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Workspace session is not in this window yet. Sign in once, then stay in the app.',
                      style: TextStyle(color: p.muted, fontSize: 13, height: 1.35),
                    ),
                  ),
                  const SizedBox(width: 12),
                  FilledButton(
                    onPressed: _nativeGoogleThenReload,
                    child: const Text('Sign in'),
                  ),
                ],
              ),
            ),
          )
        : null;

    final webBody = Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: p.cream),
        if (_error != null)
          _ErrorPane(
            message: _error!,
            onRetry: _reload,
            onExternal: _openExternal,
            onSignIn: _nativeGoogleThenReload,
          )
        else
          WebViewWidget(controller: _controller),
        if (_loading && _error == null)
          IgnorePointer(
            child: ColoredBox(
              color: p.cream.withValues(alpha: 0.72),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    BevelMark(size: 40, palette: p),
                    const SizedBox(height: 14),
                    const BevelWordmark(size: BevelWordmarkSize.md),
                  ],
                ),
              ),
            ),
          ),
      ],
    );

    return Scaffold(
      backgroundColor: p.cream,
      appBar: BevelShellBar(
        title: _channelLabel,
        subtitle: spaceLabel.isEmpty ? null : spaceLabel,
        onTitleTap: showPhonePicker ? _openChannelPicker : widget.onSwitchWorkspace,
        progress: _loading
            ? (_progress > 0 && _progress < 100 ? _progress / 100 : 0)
            : null,
        actions: [
          if (!_sessionHealthy)
            TextButton(
              onPressed: _nativeGoogleThenReload,
              child: const Text('Sign in'),
            )
          else if (!showRail)
            IconButton(
              tooltip: 'Timeline',
              onPressed: () => _navigatePath('/timeline'),
              icon: const Icon(Icons.schedule_outlined),
            ),
          PopupMenuButton<String>(
            tooltip: 'More',
            icon: const Icon(Icons.more_horiz_rounded),
            onSelected: (value) {
              switch (value) {
                case 'channels':
                  _openChannelPicker();
                case 'timeline':
                  _navigatePath('/timeline');
                case 'switch':
                  widget.onSwitchWorkspace?.call();
                case 'share':
                  unawaited(_share());
                case 'notifications':
                  widget.onOpenNotifications?.call();
                case 'reload':
                  unawaited(_reload());
                case 'home':
                  unawaited(_goHome());
                case 'browser':
                  unawaited(_openExternal());
                case 'hermes':
                  unawaited(_openHermes());
                case 'hub':
                  widget.onOpenNativeHub?.call();
                case 'signin':
                  unawaited(_nativeGoogleThenReload());
              }
            },
            itemBuilder: (ctx) => [
              if (showPhonePicker)
                const PopupMenuItem(
                  value: 'channels',
                  child: Text('Channels'),
                ),
              const PopupMenuItem(
                value: 'timeline',
                child: Text('Timeline'),
              ),
              if (widget.onSwitchWorkspace != null)
                const PopupMenuItem(
                  value: 'switch',
                  child: Text('Switch space'),
                ),
              const PopupMenuItem(
                value: 'share',
                child: Text('Share'),
              ),
              if (widget.onOpenNotifications != null)
                const PopupMenuItem(
                  value: 'notifications',
                  child: Text('Notifications'),
                ),
              const PopupMenuItem(
                value: 'reload',
                child: Text('Reload'),
              ),
              if (!widget.consumerMode || kDebugMode) ...[
                if (hermes != null && HermesBridge.isSupportedPlatform)
                  const PopupMenuItem(
                    value: 'hermes',
                    child: Text('Hermes Desktop'),
                  ),
                if (widget.onOpenNativeHub != null)
                  const PopupMenuItem(
                    value: 'hub',
                    child: Text('Native tools'),
                  ),
              ],
              const PopupMenuItem(
                value: 'signin',
                child: Text('Re-authenticate'),
              ),
              const PopupMenuItem(
                value: 'browser',
                child: Text('Open in Safari'),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (signInBanner != null) signInBanner,
          Expanded(
            child: showRail
                ? Row(
                    children: [
                      SizedBox(
                        width: layout.isFoldInner ? 260 : 300,
                        child: Material(
                          color: p.railWash,
                          child: WorkspaceRail(
                            activePath: path,
                            channels: _channels,
                            onNavigate: _navigatePath,
                            onOpenTimeline: () => _navigatePath('/timeline'),
                            onOpenNativeHub:
                                widget.consumerMode ? null : widget.onOpenNativeHub,
                            onOpenNotifications: widget.onOpenNotifications,
                          ),
                        ),
                      ),
                      VerticalDivider(
                        width: 1,
                        thickness: 1,
                        color: p.border,
                      ),
                      Expanded(child: webBody),
                    ],
                  )
                : webBody,
          ),
        ],
      ),
    );
  }
}

class _ErrorPane extends StatelessWidget {
  const _ErrorPane({
    required this.message,
    required this.onRetry,
    required this.onExternal,
    this.onSignIn,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onExternal;
  final VoidCallback? onSignIn;

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    return BevelAtmosphere(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              BevelMark(size: 44, palette: p),
              const SizedBox(height: 16),
              Text(
                'Could not load this space',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(color: p.muted, height: 1.45),
              ),
              const SizedBox(height: 20),
              FilledButton(onPressed: onRetry, child: const Text('Retry')),
              if (onSignIn != null) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: onSignIn,
                  child: const Text('Sign in with Google'),
                ),
              ],
              TextButton(
                onPressed: onExternal,
                child: const Text('Open in Safari'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

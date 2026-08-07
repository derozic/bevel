import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../config.dart';
import '../native/hermes_bridge.dart';
import '../native/google_native_auth.dart';
import '../native/oauth_browser.dart';
import '../native/session_bridge.dart';
import '../native/sharing_service.dart';
import 'channel_picker_sheet.dart';
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
      ..setBackgroundColor(const Color(0xFF0A0E12))
      ..setUserAgent(
        'Mozilla/5.0 (Mobile; BevelNative/${BevelConfig.versionLabel}) '
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 '
        'BevelNative/${BevelConfig.versionLabel}',
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
            // Operator console / integrations stay in system browser.
            if (SessionBridge.isOperatorPath(path) ||
                path.contains('/console')) {
              launchUrl(uri, mode: LaunchMode.externalApplication);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Console and integrations open in the browser — '
                      'this app is for chat.',
                    ),
                    duration: Duration(seconds: 3),
                  ),
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
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Workspace session missing — signing in with Google…',
              ),
              duration: Duration(seconds: 3),
            ),
          );
        }
        await _nativeGoogleThenReload();
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
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Google sign-in failed: $e')),
        );
      }
      // Last resort: system browser
      await _oauth.openSystemLogin();
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result.message)),
    );
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
    final scheme = Theme.of(context).colorScheme;
    final hermes = widget.hermes;
    final layout = BevelLayoutInfo.of(context);
    final path = _currentUri?.path ?? widget.initialPath;
    final showRail = layout.prefersSplit ||
        (layout.isFoldInner &&
            layout.isLandscape &&
            layout.size.width >= 700);
    final showPhonePicker = !showRail;

    final webBody = Stack(
      children: [
        if (_error != null)
          _ErrorPane(
            message: _error!,
            onRetry: _reload,
            onExternal: _openExternal,
            onSignIn: _nativeGoogleThenReload,
          )
        else
          WebViewWidget(controller: _controller),
        if (kDebugMode)
          Positioned(
            right: 12,
            bottom: 12,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0xCC0F1419),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF243040)),
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: Text(
                  [
                    if (showRail) 'dual-pane',
                    layout.layoutClass.name,
                    if (_sessionHealthy) 'session-ok' else 'session-?',
                    if (widget.handoffCode != null) 'handoff',
                    if (widget.consumerMode) 'consumer',
                  ].join(' · '),
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF9AA8B5),
                  ),
                ),
              ),
            ),
          ),
      ],
    );

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _channelLabel,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
            Text(
              [
                if (widget.workspaceLabel != null &&
                    widget.workspaceLabel!.isNotEmpty)
                  widget.workspaceLabel!,
                _currentUri?.host ??
                    widget.workspaceHost ??
                    Uri.parse(BevelConfig.workspaceUrl).host,
                if (showRail) 'dual-pane',
                if (_sessionHealthy) 'signed in',
              ].join(' · '),
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF9AA8B5),
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
        actions: [
          if (widget.onSwitchWorkspace != null)
            IconButton(
              tooltip: 'Switch workspace',
              onPressed: widget.onSwitchWorkspace,
              icon: const Icon(Icons.workspaces_outlined),
            ),
          if (showPhonePicker)
            IconButton(
              tooltip: 'Channels',
              onPressed: _openChannelPicker,
              icon: const Icon(Icons.tag_rounded),
            ),
          if (!showRail)
            IconButton(
              tooltip: 'Timeline',
              onPressed: () => _navigatePath('/timeline'),
              icon: const Icon(Icons.schedule_outlined),
            ),
          if (!_sessionHealthy)
            IconButton(
              tooltip: 'Sign in with Google',
              onPressed: _nativeGoogleThenReload,
              icon: const Icon(Icons.login_rounded),
            ),
          IconButton(
            tooltip: '~general',
            onPressed: _goHome,
            icon: const Icon(Icons.home_outlined),
          ),
          IconButton(
            tooltip: 'Reload',
            onPressed: _reload,
            icon: const Icon(Icons.refresh_rounded),
          ),
          PopupMenuButton<String>(
            tooltip: 'More',
            icon: const Icon(Icons.more_vert_rounded),
            onSelected: (value) {
              switch (value) {
                case 'switch':
                  widget.onSwitchWorkspace?.call();
                case 'share':
                  unawaited(_share());
                case 'browser':
                  unawaited(_openExternal());
                case 'notifications':
                  widget.onOpenNotifications?.call();
                case 'hermes':
                  unawaited(_openHermes());
                case 'hub':
                  widget.onOpenNativeHub?.call();
                case 'signin':
                  unawaited(_nativeGoogleThenReload());
              }
            },
            itemBuilder: (ctx) => [
              if (widget.onSwitchWorkspace != null)
                const PopupMenuItem(
                  value: 'switch',
                  child: ListTile(
                    dense: true,
                    leading: Icon(Icons.workspaces_outlined),
                    title: Text('Switch workspace'),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              const PopupMenuItem(
                value: 'share',
                child: ListTile(
                  dense: true,
                  leading: Icon(Icons.ios_share_rounded),
                  title: Text('Share channel'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'browser',
                child: ListTile(
                  dense: true,
                  leading: Icon(Icons.open_in_browser_rounded),
                  title: Text('Open in browser'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              if (widget.onOpenNotifications != null)
                const PopupMenuItem(
                  value: 'notifications',
                  child: ListTile(
                    dense: true,
                    leading: Icon(Icons.notifications_outlined),
                    title: Text('Notifications'),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              if (!widget.consumerMode || kDebugMode) ...[
                if (hermes != null && HermesBridge.isSupportedPlatform)
                  const PopupMenuItem(
                    value: 'hermes',
                    child: ListTile(
                      dense: true,
                      leading: Icon(Icons.auto_awesome_outlined),
                      title: Text('Hermes Desktop'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                if (widget.onOpenNativeHub != null)
                  const PopupMenuItem(
                    value: 'hub',
                    child: ListTile(
                      dense: true,
                      leading: Icon(Icons.hub_outlined),
                      title: Text('Native integrations'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
              ],
              if (_sessionHealthy)
                const PopupMenuItem(
                  value: 'signin',
                  child: ListTile(
                    dense: true,
                    leading: Icon(Icons.login_rounded),
                    title: Text('Re-authenticate'),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
            ],
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: _loading
              ? LinearProgressIndicator(
                  value: _progress > 0 && _progress < 100
                      ? _progress / 100
                      : null,
                  minHeight: 2,
                  color: scheme.primary,
                  backgroundColor: Colors.transparent,
                )
              : const SizedBox(height: 2),
        ),
      ),
      body: showRail
          ? Row(
              children: [
                SizedBox(
                  width: layout.isFoldInner ? 260 : 300,
                  child: Material(
                    color: const Color(0xFF0F1419),
                    child: WorkspaceRail(
                      activePath: path,
                      channels: _channels,
                      onNavigate: _navigatePath,
                      onOpenTimeline: () => _navigatePath('/timeline'),
                      // Consumer: no native hub on rail; power users use More menu
                      onOpenNativeHub:
                          widget.consumerMode ? null : widget.onOpenNativeHub,
                      onOpenNotifications: widget.onOpenNotifications,
                    ),
                  ),
                ),
                const VerticalDivider(
                  width: 1,
                  thickness: 1,
                  color: Color(0xFF243040),
                ),
                Expanded(child: webBody),
              ],
            )
          : webBody,
      floatingActionButton: showPhonePicker
          ? FloatingActionButton.small(
              heroTag: 'bevel.channels.fab',
              tooltip: 'Channels',
              backgroundColor: scheme.primary.withValues(alpha: 0.92),
              foregroundColor: Colors.white,
              onPressed: _openChannelPicker,
              child: const Icon(Icons.tag_rounded),
            )
          : null,
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded,
                size: 40, color: Color(0xFF94A3B8)),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFFCBD5E1)),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                FilledButton(onPressed: onRetry, child: const Text('Retry')),
                if (onSignIn != null)
                  OutlinedButton(
                    onPressed: onSignIn,
                    child: const Text('Sign in with Google'),
                  ),
                TextButton(
                  onPressed: onExternal,
                  child: const Text('Open in browser'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

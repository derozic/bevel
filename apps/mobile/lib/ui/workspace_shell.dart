import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../config.dart';
import '../native/hermes_bridge.dart';
import '../native/oauth_browser.dart';
import '../native/sharing_service.dart';

/// In-app workspace browser (WKWebView on macOS / iOS, WebView on Android).
///
/// This is the primary Mac Silicon surface: full workspace chrome inside the
/// native BEVEL window instead of bouncing to an external browser.
class WorkspaceShellPage extends StatefulWidget {
  const WorkspaceShellPage({
    super.key,
    this.initialPath = '/',
    this.hermes,
  });

  final String initialPath;
  final HermesBridge? hermes;

  @override
  State<WorkspaceShellPage> createState() => _WorkspaceShellPageState();
}

class _WorkspaceShellPageState extends State<WorkspaceShellPage> {
  late final WebViewController _controller;
  final _sharing = const SharingService();
  final _oauth = const OAuthBrowser();
  var _loading = true;
  var _progress = 0;
  String? _title;
  String? _error;
  Uri? _currentUri;

  @override
  void initState() {
    super.initState();
    final start = BevelConfig.workspaceUri(widget.initialPath);
    _currentUri = start;

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0A0E12))
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
            setState(() {
              _loading = false;
              _title = title;
              _currentUri = Uri.tryParse(url) ?? _currentUri;
            });
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
            // Google/GitHub/Auth.js must leave the WebView (IdP policy + reliability).
            if (BevelConfig.isOAuthNavigation(uri)) {
              _oauth.open(uri);
              return NavigationDecision.prevent;
            }
            // Workspace hosts stay in-app; other origins open outside.
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

  Future<void> _reload() => _controller.reload();

  Future<void> _goHome() =>
      _controller.loadRequest(BevelConfig.workspaceUri('/'));

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
    final handoff = bridge.handoffForWorkspace(
      workspaceUrl: uri.toString(),
      channel: channel,
      tenant: tenant,
      mode: 'build',
      surface: 'desktop',
      projectPath: null, // resolved by bridge from env / ~/dev
      prompt:
          'Continue work from BEVEL workspace: ${uri.toString()}'
          '${channel != null ? ' (channel ^$channel)' : ''}'
          '${tenant != null ? ' tenant=$tenant' : ''}. '
          'Use skill bevel-workspace. When done: open returnUrl '
          '(bevel://hermes/return) with a short status summary.',
    ).copyWith(
      successCriteria:
          'Return to BEVEL channel with status + evidence; no secrets in chat',
    );
    final result = await bridge.openWithHandoff(handoff);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result.message)),
    );
  }

  /// Support /bevel/{slug}, /^{slug}, and /bevel/c/{slug}.
  static String? _channelFromUri(Uri uri) {
    final path = uri.path;
    if (path.startsWith('/bevel/c/')) {
      final rest = path.substring('/bevel/c/'.length);
      final slug = rest.split('/').firstWhere((s) => s.isNotEmpty, orElse: () => '');
      return slug.isEmpty ? null : slug;
    }
    if (path.startsWith('/bevel/')) {
      final rest = path.substring('/bevel/'.length);
      final slug = rest.split('/').firstWhere((s) => s.isNotEmpty, orElse: () => '');
      if (slug.isEmpty || slug == 'talk' || slug == 'session') return null;
      return slug;
    }
    // Public short path: /^general
    final segs = path.split('/').where((s) => s.isNotEmpty).toList();
    if (segs.isNotEmpty && segs.first.startsWith('^')) {
      final slug = segs.first.substring(1);
      return slug.isEmpty ? null : slug;
    }
    // Fragment sometimes used
    if (uri.fragment.startsWith('^')) {
      return uri.fragment.substring(1);
    }
    return null;
  }

  static String? _tenantFromHost(String host) {
    final h = host.toLowerCase();
    // bevel.2x4m.cc / 2x4m.bevel.lvh.me / 2x4m.lvh.me
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

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hermes = widget.hermes;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _title?.isNotEmpty == true ? _title! : 'Workspace',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
            Text(
              _currentUri?.host ?? BevelConfig.baseUrl,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF9AA8B5),
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Sign in (system browser)',
            onPressed: () => _oauth.openSystemLogin(),
            icon: const Icon(Icons.login_rounded),
          ),
          IconButton(
            tooltip: 'Home',
            onPressed: _goHome,
            icon: const Icon(Icons.home_outlined),
          ),
          IconButton(
            tooltip: 'Reload',
            onPressed: _reload,
            icon: const Icon(Icons.refresh_rounded),
          ),
          Semantics(
            identifier: 'bevel.shell.share',
            button: true,
            label: 'Share workspace',
            child: IconButton(
              tooltip: 'Share',
              onPressed: _share,
              icon: const Icon(Icons.ios_share_rounded),
            ),
          ),
          if (hermes != null && HermesBridge.isSupportedPlatform)
            Semantics(
              identifier: 'bevel.shell.open_hermes',
              button: true,
              label: 'Open current page in Hermes Desktop',
              child: IconButton(
                tooltip: 'Open in Hermes Desktop',
                onPressed: _openHermes,
                icon: const Icon(Icons.auto_awesome_outlined),
              ),
            ),
          IconButton(
            tooltip: 'Open in browser',
            onPressed: _openExternal,
            icon: const Icon(Icons.open_in_browser_rounded),
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
      body: Stack(
        children: [
          if (_error != null)
            _ErrorPane(
              message: _error!,
              onRetry: _reload,
              onExternal: _openExternal,
            )
          else
            WebViewWidget(controller: _controller),
          if (kDebugMode && defaultTargetPlatform == TargetPlatform.macOS)
            Positioned(
              right: 12,
              bottom: 12,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0xCC0F1419),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF243040)),
                ),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  child: Text(
                    'macOS · Apple Silicon',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF9AA8B5),
                    ),
                  ),
                ),
              ),
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
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onExternal;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 40, color: Color(0xFF9AA8B5)),
              const SizedBox(height: 16),
              const Text(
                'Could not load workspace',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF9AA8B5), height: 1.4),
              ),
              const SizedBox(height: 8),
              const Text(
                'On macOS, ensure the app has network client entitlement '
                'and Caddy is serving your .lvh.me tenant.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF6B7A88), fontSize: 12, height: 1.4),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  FilledButton(onPressed: onRetry, child: const Text('Retry')),
                  const SizedBox(width: 12),
                  OutlinedButton(
                    onPressed: onExternal,
                    child: const Text('Open in browser'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

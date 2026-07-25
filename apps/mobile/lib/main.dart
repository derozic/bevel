import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'config.dart';
import 'desktop/window_bootstrap.dart';
import 'native/deep_links.dart';
import 'native/health_service.dart';
import 'native/hermes_bridge.dart';
import 'native/hermes_handoff.dart';
import 'native/hermes_return_reporter.dart';
import 'native/native_capabilities.dart';
import 'native/notification_service.dart';
import 'native/oauth_browser.dart';
import 'native/sharing_service.dart';
import 'ui/native_hub_page.dart';
import 'ui/workspace_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await bootstrapDesktopWindow();
  runApp(const BevelApp());
}

class BevelApp extends StatelessWidget {
  const BevelApp({super.key});

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF22C55E);
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: Brightness.dark,
      primary: accent,
      surface: const Color(0xFF0F1419),
    );

    return MaterialApp(
      title: BevelConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: const Color(0xFF0A0E12),
        appBarTheme: const AppBarTheme(
          centerTitle: false,
          elevation: 0,
          backgroundColor: Color(0xFF0F1419),
          foregroundColor: Color(0xFFF4F7F5),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF141A21),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF243040)),
          ),
        ),
      ),
      home: const BevelHomePage(),
    );
  }
}

class BevelHomePage extends StatefulWidget {
  const BevelHomePage({super.key});

  @override
  State<BevelHomePage> createState() => _BevelHomePageState();
}

class _BevelHomePageState extends State<BevelHomePage> {
  final _sharing = const SharingService();
  final _health = HealthService();
  final _notifications = NotificationService();
  final _deepLinks = DeepLinkService();
  final _oauth = const OAuthBrowser();
  final _hermes = HermesBridge();

  NativeCapabilities? _caps;
  HermesBridgeStatus? _hermesStatus;
  HermesHandoffV1? _pendingHandoff;
  String? _status;
  String? _lastDeepLink;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final caps = await NativeCapabilities.probe();
      if (caps.supportsNotifications) {
        await _notifications.initialize();
      }
      if (caps.supportsHealth) {
        await _health.configure();
      }
      if (caps.supportsDeepLinks) {
        await _deepLinks.listen(_onDeepLink);
      }
      HermesBridgeStatus? hermesStatus;
      if (caps.supportsHermesBridge) {
        hermesStatus = await _hermes.probe();
      }
      if (!mounted) return;
      setState(() {
        _caps = caps;
        _hermesStatus = hermesStatus;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _status = 'Native probe limited: $e');
    }
  }

  void _onDeepLink(Uri uri) {
    if (!mounted) return;
    final action = DeepLinkService.parse(uri);
    setState(() {
      _lastDeepLink = uri.toString();
      _status = 'Deep link: ${action.kind} → ${action.route ?? uri}';
      if (action.handoff != null) {
        _pendingHandoff = action.handoff;
      }
    });

    switch (action.kind) {
      case 'auth_complete':
        // System-browser OAuth finished → land in workspace shell.
        // Cookie hop Safari→WKWebView may still need a refresh; user can Retry.
        setState(() {
          _status =
              'Signed in — opening workspace. If you still see login, tap Retry.';
        });
        _openWorkspace(path: action.route ?? '/');
        break;
      case 'hermes_status':
        _openNativeHub(focusHermes: true);
        break;
      case 'hermes_return':
        final summary = action.returnSummary;
        final st = action.returnStatus ?? 'done';
        final channel = action.channel;
        setState(() {
          _status = summary == null || summary.isEmpty
              ? 'Hermes returned: $st'
              : 'Hermes returned ($st): $summary';
        });
        // Prefer short public channel path for focus.
        final path = channel != null && channel.isNotEmpty
            ? '/^${channel.toLowerCase()}'
            : (action.route != null && action.route != '/native-hub'
                ? action.route!
                : '/');
        _openWorkspace(path: path);
        // Best-effort: post return note to FastAPI when fleet key is configured.
        if (channel != null && channel.isNotEmpty) {
          unawaited(
            HermesReturnReporter.postChannelNote(
              channel: channel,
              status: st,
              summary: summary,
            ),
          );
        }
        break;
      case 'hermes_open':
        if (action.handoff != null) {
          setState(() => _pendingHandoff = action.handoff);
        }
        if (action.route != null) {
          _openWorkspace(path: action.route!);
        }
        break;
      default:
        if (action.route != null) {
          _openWorkspace(path: action.route!);
        }
    }
  }

  @override
  void dispose() {
    _deepLinks.dispose();
    _hermes.dispose();
    super.dispose();
  }

  void _openWorkspace({String path = '/'}) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => WorkspaceShellPage(
          initialPath: path,
          hermes: _hermes,
        ),
      ),
    );
  }

  Future<void> _openExternal(Uri uri) async {
    setState(() => _status = 'Opening ${uri.host}${uri.path}…');
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        setState(() => _status = 'Could not open $uri');
      } else if (mounted) {
        setState(() => _status = null);
      }
    } catch (e) {
      if (mounted) setState(() => _status = 'Failed: $e');
    }
  }

  void _openNativeHub({bool focusHermes = false}) {
    final caps = _caps;
    if (caps == null) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => NativeHubPage(
          capabilities: caps,
          sharing: _sharing,
          health: _health,
          notifications: _notifications,
          hermes: _hermes,
          initialHermesStatus: _hermesStatus,
          focusHermes: focusHermes,
          onHermesStatus: (s) {
            if (mounted) setState(() => _hermesStatus = s);
          },
        ),
      ),
    );
  }

  Future<void> _openHermes() async {
    final handoff = (_pendingHandoff ??
            _hermes.handoffForWorkspace(
              workspaceUrl: BevelConfig.workspaceUrl,
              prompt:
                  'Operator opened Hermes from BEVEL home. Coordinate with fleet @hermes and the active workspace.',
              mode: 'orchestrate',
            ))
        .withDefaultReturn();
    final result = await _hermes.openWithHandoff(handoff);
    if (!mounted) return;
    setState(() {
      _pendingHandoff = result.handoff;
      _status = result.message;
    });
  }

  Future<void> _continueWithGoogle() async {
    setState(() => _status = 'Opening secure sign-in…');
    final ok = await _oauth.openSystemLogin();
    if (!mounted) return;
    if (!ok) {
      // Fallback: open login inside shell (still may bounce IdP out).
      setState(() => _status = 'Opening login in workspace window…');
      _openWorkspace(path: BevelConfig.loginPath);
      return;
    }
    setState(() {
      _status =
          'Finish Google in the browser window. We will open your workspace when you return.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final caps = _caps;
    final isMac = caps?.platformLabel == 'macos';
    final hermesLabel = _hermesStatus?.summary;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'B',
                style: TextStyle(
                  color: scheme.primary,
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Text(BevelConfig.appName),
            if (caps?.isAppleSiliconMac == true) ...[
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  border: Border.all(color: scheme.primary.withValues(alpha: 0.4)),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Apple Silicon',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: scheme.primary,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (caps?.supportsHermesBridge == true)
            IconButton(
              tooltip: 'Open Hermes Desktop',
              onPressed: _openHermes,
              icon: const Icon(Icons.auto_awesome_outlined),
            ),
          IconButton(
            tooltip: 'Native integrations',
            onPressed: caps == null ? null : () => _openNativeHub(),
            icon: const Icon(Icons.hub_outlined),
          ),
          IconButton(
            tooltip: 'Copy workspace URL',
            onPressed: () async {
              await Clipboard.setData(
                ClipboardData(text: BevelConfig.workspaceUrl),
              );
              if (mounted) {
                setState(() => _status = 'Copied ${BevelConfig.workspaceUrl}');
              }
            },
            icon: const Icon(Icons.link_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 40),
              children: [
                Text(
                  BevelConfig.appTagline,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFFF4F7F5),
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  isMac
                      ? 'One click to sign in. Workspace opens in this window — '
                          'no browser tabs, no cookie confusion.'
                      : 'Native workspace shell with Health, share, notifications, '
                          'and deep links — one Flutter codebase including Mac.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF9AA8B5),
                        height: 1.45,
                      ),
                ),
                const SizedBox(height: 28),
                Semantics(
                  identifier: 'bevel.home.continue_google',
                  button: true,
                  label: 'Continue with Google',
                  child: FilledButton.icon(
                    onPressed: _continueWithGoogle,
                    icon: const Icon(Icons.login_rounded),
                    label: const Text('Continue with Google'),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 16,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Semantics(
                  identifier: 'bevel.home.open_workspace',
                  button: true,
                  label: 'Open workspace',
                  child: FilledButton.tonalIcon(
                    onPressed: () => _openWorkspace(),
                    icon: const Icon(Icons.forum_outlined),
                    label: Text(
                      isMac ? 'Open workspace window' : 'Open workspace',
                    ),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 14,
                      ),
                    ),
                  ),
                ),
                if (caps?.supportsHermesBridge == true) ...[
                  const SizedBox(height: 10),
                  Semantics(
                    identifier: 'bevel.home.open_hermes',
                    button: true,
                    label: 'Open Hermes Desktop with handoff',
                    child: OutlinedButton.icon(
                      onPressed: _openHermes,
                      icon: const Icon(Icons.auto_awesome_outlined),
                      label: const Text('Open in Hermes Desktop'),
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Semantics(
                  identifier: 'bevel.home.native_hub',
                  button: true,
                  label: 'Native integrations',
                  child: TextButton.icon(
                    onPressed: caps == null ? null : () => _openNativeHub(),
                    icon: const Icon(Icons.hub_outlined, size: 18),
                    label: const Text('Native integrations'),
                  ),
                ),
                TextButton.icon(
                  onPressed: () => _openExternal(BevelConfig.entryUri()),
                  icon: const Icon(Icons.open_in_browser_rounded, size: 18),
                  label: const Text('Open in browser (recovery)'),
                ),
                if (hermesLabel != null) ...[
                  const SizedBox(height: 20),
                  Card(
                    child: ListTile(
                      leading: Icon(
                        _hermesStatus?.serveOnline == true
                            ? Icons.check_circle_outline
                            : Icons.auto_awesome_outlined,
                        color: scheme.primary,
                      ),
                      title: const Text('Hermes Desktop'),
                      subtitle: Text(hermesLabel),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => _openNativeHub(focusHermes: true),
                    ),
                  ),
                ],
                if (isMac) ...[
                  const SizedBox(height: 24),
                  Card(
                    child: ListTile(
                      leading: Icon(Icons.desktop_mac_rounded,
                          color: scheme.primary),
                      title: const Text('Apple Silicon'),
                      subtitle: Text(
                        caps?.isAppleSiliconMac == true
                            ? 'arm64 · ${caps?.deviceModel ?? "Mac"}'
                            : 'macOS desktop build',
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                Text(
                  'Entry: ${BevelConfig.baseUrl}\n'
                  'Workspace: ${BevelConfig.workspaceUrl}\n'
                  'API: ${BevelConfig.apiBaseUrl}\n'
                  'Client v${BevelConfig.versionLabel}'
                  '${caps != null ? ' · ${caps.platformLabel}' : ''}'
                  '${caps?.isAppleSiliconMac == true ? ' · arm64' : ''}'
                  '${_lastDeepLink != null ? '\nLast link: $_lastDeepLink' : ''}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B7A88),
                        height: 1.5,
                      ),
                ),
                if (_status != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _status!,
                    style: TextStyle(color: scheme.primary, fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

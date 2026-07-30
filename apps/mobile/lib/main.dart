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
import 'native/push_bootstrap.dart';
import 'ui/escalation/escalation_inbox.dart';
import 'ui/layout/adaptive_scaffold.dart';
import 'ui/layout/bevel_breakpoints.dart';
import 'ui/native_hub_page.dart';
import 'ui/onboarding/google_workspace_onboarding.dart';
import 'ui/onboarding/onboarding_state.dart';
import 'ui/settings/notification_settings_page.dart';
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
  OnboardingState _onboarding = OnboardingState();
  final _escalations = EscalationRepository();
  String? _status;
  String? _lastDeepLink;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final onboarding = await OnboardingState.load();
      final caps = await NativeCapabilities.probe();
      if (caps.supportsNotifications) {
        await _notifications.initialize();
        // Best-effort Firebase/FCM when platform config is present
        unawaited(PushBootstrap.ensureInitialized());
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
        _onboarding = onboarding;
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
        unawaited(
          _onAuthComplete(
            action.route ?? '/',
            email: action.email,
            userId: action.userId,
            userName: action.userName,
          ),
        );
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
            ? '/~${channel.toLowerCase()}'
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

  Future<void> _onAuthComplete(
    String path, {
    String? email,
    String? userId,
    String? userName,
  }) async {
    final next = _onboarding.copyWith(
      completedGoogleSignIn: true,
      userEmail: email?.trim().isNotEmpty == true ? email!.trim() : null,
      userId: userId?.trim().isNotEmpty == true ? userId!.trim() : null,
      userName: userName?.trim().isNotEmpty == true ? userName!.trim() : null,
    );
    await next.save();
    if (!mounted) return;
    setState(() {
      _onboarding = next;
      _status =
          'Signed in — opening workspace. If you still see login, tap Retry.';
    });
    await _maybeShowEscalationInbox();
    if (!mounted) return;
    _openWorkspace(path: path);
  }

  Future<void> _maybeShowEscalationInbox() async {
    final email = _onboarding.userEmail;
    final userId = _onboarding.userId;
    if (email.isEmpty && userId.isEmpty) return;

    final items = await _escalations.fetchUnacked(
      userEmail: email.isNotEmpty ? email : null,
      userId: userId.isNotEmpty ? userId : null,
    );
    if (!mounted || items.isEmpty) return;
    // Local high-priority alert when returning with pending ^escalations
    if (_onboarding.pushEscalations) {
      await _notifications.showEscalationAlert(
        id: 9001,
        title: '${items.length} escalation${items.length == 1 ? '' : 's'}',
        body: items.first.bodyPreview.isNotEmpty
            ? items.first.bodyPreview
            : 'Open BEVEL to acknowledge',
        payload: 'bevel://timeline',
      );
    }
    if (!mounted) return;
    await EscalationInboxSheet.showIfNeeded(
      context,
      items: items,
      onAck: (item) async {
        await _escalations.ack(
          item.id,
          userEmail: email.isNotEmpty ? email : null,
          userId: userId.isNotEmpty ? userId : null,
        );
      },
      onOpen: (item) {
        Navigator.of(context).pop(); // close sheet
        final slug = item.channelSlug;
        _openWorkspace(
          path: slug != null && slug.isNotEmpty ? '/~$slug' : '/timeline',
        );
      },
    );
  }

  Future<void> _maybePromptNotifications() async {
    if (!_onboarding.shouldPromptNotifications) return;
    if (!(_caps?.supportsNotifications ?? false)) return;
    if (!mounted) return;
    final go = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141A21),
        title: const Text('Stay on top of escalations'),
        content: const Text(
          'When someone writes ^yourhandle, BEVEL needs permission to '
          'interrupt you — louder than a soft @mention. Enable notifications?',
          style: TextStyle(color: Color(0xFFCBD5E1), height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Not now'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Enable'),
          ),
        ],
      ),
    );
    final granted = go == true ? await _notifications.requestPermission() : false;
    if (granted) {
      await PushBootstrap.ensureInitialized();
      await _notifications.syncPushToken();
    }
    final next = _onboarding.copyWith(
      askedNotificationPermission: true,
      notificationPermissionGranted: granted,
    );
    await next.save();
    if (mounted) setState(() => _onboarding = next);
  }

  void _openWorkspace({String path = '/'}) {
    Navigator.of(context)
        .push(
      MaterialPageRoute<void>(
        builder: (_) => WorkspaceShellPage(
          initialPath: path,
          hermes: _hermes,
          onOpenNativeHub: () => _openNativeHub(),
        ),
      ),
    )
        .then((_) async {
      final next = _onboarding.copyWith(completedWorkspaceOpen: true);
      await next.save();
      if (!mounted) return;
      setState(() => _onboarding = next);
      await _maybePromptNotifications();
    });
  }

  void _openNotificationSettings() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => NotificationSettingsPage(
          initial: _onboarding,
          onChanged: (s) {
            if (mounted) setState(() => _onboarding = s);
          },
          onRequestPermission: () async {
            final ok = await _notifications.requestPermission();
            if (ok) {
              await PushBootstrap.ensureInitialized();
              await _notifications.syncPushToken();
            }
            return ok;
          },
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
    final layout = BevelLayoutInfo.of(context);

    // Rich multi-step Google Workspace onboarding for first launch
    if (_onboarding.needsOnboarding && caps != null) {
      return GoogleWorkspaceOnboarding(
        state: _onboarding,
        onContinueWithGoogle: _continueWithGoogle,
        onSkipToWorkspace: () => _openWorkspace(),
        onFinished: (s) {
          setState(() => _onboarding = s);
        },
        onOpenNotificationSettings: _openNotificationSettings,
      );
    }

    return AdaptiveScaffold(
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
            if (layout.isFoldCover) ...[
              const SizedBox(width: 8),
              const Text(
                'Cover',
                style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
              ),
            ],
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Notification settings',
            onPressed: _openNotificationSettings,
            icon: const Icon(Icons.notifications_outlined),
          ),
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
      body: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: layout.contentMaxWidth.clamp(280, 720)),
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                layout.isFoldCover ? 16 : 24,
                layout.isFoldCover ? 20 : 32,
                layout.isFoldCover ? 16 : 24,
                40,
              ),
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
                const SizedBox(height: 12),
                Text(
                  'Layout: ${layout.layoutClass.name}'
                  '${layout.isFoldCover ? ' · fold cover' : ''}'
                  '${layout.isFoldInner ? ' · fold inner' : ''}'
                  '${layout.prefersSplit ? ' · split' : ''}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B7A88),
                      ),
                ),
              ],
            ),
          ),
      ),
    );
  }
}

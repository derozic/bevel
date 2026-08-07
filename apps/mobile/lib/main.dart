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
import 'native/push_handlers.dart';
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
  var _didAutoOpenWorkspace = false;
  var _workspaceOpen = false;

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
        _notifications.onNotificationTap = _onNotificationPayload;
        // Best-effort Firebase/FCM when platform config is present
        unawaited(
          PushHandlers.install(
            notifications: _notifications,
            userId: onboarding.userId.isNotEmpty ? onboarding.userId : null,
            onOpenPayload: _onNotificationPayload,
          ),
        );
        final launchPayload = await _notifications.consumeLaunchPayload();
        if (launchPayload != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _onNotificationPayload(launchPayload);
          });
        }
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

      // Consumer default: signed-in users land in chat, not a developer hub.
      if (!_didAutoOpenWorkspace &&
          (onboarding.completedGoogleSignIn || onboarding.sessionHealthy) &&
          !onboarding.needsOnboarding) {
        _didAutoOpenWorkspace = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || _workspaceOpen) return;
          _openWorkspace(path: onboarding.lastWorkspacePath);
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _status = 'Native probe limited: $e');
    }
  }

  void _onNotificationPayload(String payload) {
    if (!mounted) return;
    final uri = Uri.tryParse(payload);
    if (uri != null && (uri.scheme == 'bevel' || uri.hasScheme)) {
      _onDeepLink(uri);
      return;
    }
    // Bare channel slug or path
    final p = payload.trim();
    if (p.startsWith('/')) {
      _openWorkspace(path: p);
    } else if (p.isNotEmpty) {
      _openWorkspace(path: '/~${p.replaceFirst(RegExp(r'^[#~^]+'), '')}');
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
        // System-browser OAuth finished → redeem handoff code in WebView jar.
        unawaited(
          _onAuthComplete(
            action.route ?? _onboarding.lastWorkspacePath,
            email: action.email,
            userId: action.userId,
            userName: action.userName,
            handoffCode: action.handoffCode,
            workspaceHost: action.workspaceHost,
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
                : '/~general');
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
        } else if (action.channel != null && action.channel!.isNotEmpty) {
          _openWorkspace(path: '/~${action.channel!.toLowerCase()}');
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
    String? handoffCode,
    String? workspaceHost,
  }) async {
    final safePath = (path.isEmpty || path == '/')
        ? (_onboarding.lastWorkspacePath.isNotEmpty
            ? _onboarding.lastWorkspacePath
            : '/~general')
        : path;
    final next = _onboarding.copyWith(
      completedGoogleSignIn: true,
      userEmail: email?.trim().isNotEmpty == true ? email!.trim() : null,
      userId: userId?.trim().isNotEmpty == true ? userId!.trim() : null,
      userName: userName?.trim().isNotEmpty == true ? userName!.trim() : null,
      lastWorkspacePath: safePath,
    );
    await next.save();
    if (!mounted) return;
    setState(() {
      _onboarding = next;
      _status = handoffCode != null && handoffCode.isNotEmpty
          ? 'Signed in — planting workspace session…'
          : 'Signed in — opening workspace…';
    });
    await _maybeShowEscalationInbox();
    if (!mounted) return;
    _openWorkspace(
      path: safePath,
      handoffCode: handoffCode,
      workspaceHost: workspaceHost,
    );
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
      await PushHandlers.install(
        notifications: _notifications,
        userId: _onboarding.userId.isNotEmpty ? _onboarding.userId : null,
        onOpenPayload: _onNotificationPayload,
      );
      await _notifications.syncPushToken(
        userId: _onboarding.userId.isNotEmpty
            ? _onboarding.userId
            : (_onboarding.userEmail.isNotEmpty ? _onboarding.userEmail : null),
      );
    }
    final next = _onboarding.copyWith(
      askedNotificationPermission: true,
      notificationPermissionGranted: granted,
    );
    await next.save();
    if (mounted) setState(() => _onboarding = next);
  }

  void _openWorkspace({
    String path = '/~general',
    String? handoffCode,
    String? workspaceHost,
  }) {
    final openPath = path.isEmpty || path == '/'
        ? (_onboarding.lastWorkspacePath.isNotEmpty
            ? _onboarding.lastWorkspacePath
            : '/~general')
        : path;
    _workspaceOpen = true;
    Navigator.of(context)
        .push(
      MaterialPageRoute<void>(
        builder: (_) => WorkspaceShellPage(
          initialPath: openPath,
          handoffCode: handoffCode,
          workspaceHost: workspaceHost,
          hermes: _hermes,
          consumerMode: true,
          onOpenNativeHub: () => _openNativeHub(),
          onOpenNotifications: _openNotificationSettings,
          onPathChanged: (p) async {
            final next = _onboarding.copyWith(lastWorkspacePath: p);
            await next.save();
            if (mounted) setState(() => _onboarding = next);
          },
          onSessionState: (healthy, email) async {
            final next = _onboarding.copyWith(
              sessionHealthy: healthy,
              userEmail: email != null && email.isNotEmpty
                  ? email
                  : null,
              completedGoogleSignIn:
                  healthy ? true : _onboarding.completedGoogleSignIn,
            );
            await next.save();
            if (!mounted) return;
            setState(() {
              _onboarding = next;
              _status = healthy
                  ? 'Workspace session ready'
                  : 'Workspace needs sign-in — use the login button if stuck';
            });
            // Bind push token to this identity for server fan-out
            if (healthy) {
              unawaited(
                _notifications.syncPushToken(
                  userId: next.userId.isNotEmpty
                      ? next.userId
                      : (email?.isNotEmpty == true ? email : null),
                ),
              );
              unawaited(
                PushHandlers.install(
                  notifications: _notifications,
                  userId: next.userId.isNotEmpty
                      ? next.userId
                      : (email?.isNotEmpty == true ? email : null),
                  onOpenPayload: _onNotificationPayload,
                ),
              );
            }
          },
        ),
      ),
    )
        .then((_) async {
      _workspaceOpen = false;
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
              await PushHandlers.install(
                notifications: _notifications,
                userId: _onboarding.userId.isNotEmpty
                    ? _onboarding.userId
                    : null,
                onOpenPayload: _onNotificationPayload,
              );
              await _notifications.syncPushToken(
                userId: _onboarding.userId.isNotEmpty
                    ? _onboarding.userId
                    : (_onboarding.userEmail.isNotEmpty
                        ? _onboarding.userEmail
                        : null),
              );
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

    final signedIn = _onboarding.completedGoogleSignIn ||
        _onboarding.sessionHealthy ||
        _onboarding.userEmail.isNotEmpty;
    final lastPath = _onboarding.lastWorkspacePath.isNotEmpty
        ? _onboarding.lastWorkspacePath
        : '/~general';

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
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Notification settings',
            onPressed: _openNotificationSettings,
            icon: const Icon(Icons.notifications_outlined),
          ),
          PopupMenuButton<String>(
            tooltip: 'More',
            icon: const Icon(Icons.more_vert_rounded),
            onSelected: (value) async {
              switch (value) {
                case 'hub':
                  _openNativeHub();
                case 'hermes':
                  await _openHermes();
                case 'copy':
                  await Clipboard.setData(
                    ClipboardData(text: BevelConfig.workspaceUrl),
                  );
                  if (mounted) {
                    setState(
                      () => _status = 'Copied ${BevelConfig.workspaceUrl}',
                    );
                  }
                case 'browser':
                  await _openExternal(BevelConfig.entryUri());
              }
            },
            itemBuilder: (ctx) => [
              if (caps?.supportsHermesBridge == true)
                const PopupMenuItem(
                  value: 'hermes',
                  child: Text('Hermes Desktop'),
                ),
              const PopupMenuItem(
                value: 'hub',
                child: Text('Advanced · native tools'),
              ),
              const PopupMenuItem(
                value: 'copy',
                child: Text('Copy workspace URL'),
              ),
              const PopupMenuItem(
                value: 'browser',
                child: Text('Open bevel.is in browser'),
              ),
            ],
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints:
              BoxConstraints(maxWidth: layout.contentMaxWidth.clamp(280, 720)),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              layout.isFoldCover ? 16 : 24,
              layout.isFoldCover ? 20 : 32,
              layout.isFoldCover ? 16 : 24,
              40,
            ),
            children: [
              Text(
                signedIn ? 'Your workspace' : BevelConfig.appTagline,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFFF4F7F5),
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                signedIn
                    ? 'Continue where you left off in chat. Channels, agents, and '
                        'live conversation match the web app.'
                    : isMac
                        ? 'Sign in with Google, then chat opens in this window — '
                            'no browser tabs, no cookie confusion.'
                        : 'Sign in with Google Workspace. Chat, channels, and '
                            'your agents — same experience as the web.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF9AA8B5),
                      height: 1.45,
                    ),
              ),
              if (_onboarding.userEmail.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  _onboarding.userName.isNotEmpty
                      ? '${_onboarding.userName} · ${_onboarding.userEmail}'
                      : _onboarding.userEmail,
                  style: const TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 13,
                  ),
                ),
              ],
              const SizedBox(height: 28),
              if (!signedIn)
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
              if (!signedIn) const SizedBox(height: 12),
              Semantics(
                identifier: 'bevel.home.open_workspace',
                button: true,
                label: signedIn ? 'Continue to chat' : 'Open chat',
                child: FilledButton.icon(
                  onPressed: () => _openWorkspace(path: lastPath),
                  icon: const Icon(Icons.forum_outlined),
                  label: Text(
                    signedIn
                        ? 'Continue to chat'
                        : (isMac ? 'Open chat window' : 'Open chat'),
                  ),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 16,
                    ),
                  ),
                ),
              ),
              if (signedIn) ...[
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () => _openWorkspace(path: '/~general'),
                  icon: const Icon(Icons.tag_rounded, size: 18),
                  label: const Text('Open ~general'),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: _continueWithGoogle,
                  icon: const Icon(Icons.login_rounded, size: 18),
                  label: const Text('Re-authenticate'),
                ),
              ],
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () => _openExternal(BevelConfig.entryUri()),
                icon: const Icon(Icons.open_in_browser_rounded, size: 18),
                label: const Text('Open in browser (recovery)'),
              ),
              const SizedBox(height: 24),
              Text(
                'Chat lives here. Console, integrations, and API keys stay on the web.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF64748B),
                      height: 1.4,
                    ),
              ),
              if (hermesLabel != null && isMac) ...[
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
              const SizedBox(height: 20),
              Text(
                'v${BevelConfig.versionLabel}'
                '${caps != null ? ' · ${caps.platformLabel}' : ''}'
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
    );
  }
}

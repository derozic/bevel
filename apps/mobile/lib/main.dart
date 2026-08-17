import 'dart:async';

import 'package:flutter/foundation.dart';
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
import 'native/macos_plugin_gaps.dart';
import 'native/native_capabilities.dart';
import 'native/notification_service.dart';
import 'native/google_native_auth.dart';
import 'native/oauth_browser.dart';
import 'native/sharing_service.dart';
import 'native/push_handlers.dart';
import 'ui/escalation/escalation_inbox.dart';
import 'ui/layout/adaptive_scaffold.dart';
import 'ui/layout/bevel_breakpoints.dart';
import 'ui/native_hub_page.dart';
import 'ui/onboarding/auth_shell.dart';
import 'ui/onboarding/google_workspace_onboarding.dart';
import 'ui/onboarding/onboarding_state.dart';
import 'ui/settings/notification_settings_page.dart';
import 'theme/theme.dart';
import 'ui/workspace_picker_page.dart';
import 'ui/workspace_shell.dart';
import 'workspace/workspace_target.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  installMacosPluginGuards();
  await bootstrapDesktopWindow();
  runApp(const BevelApp());
}

class BevelApp extends StatefulWidget {
  const BevelApp({super.key});

  @override
  State<BevelApp> createState() => _BevelAppState();
}

class _BevelAppState extends State<BevelApp> {
  late final DaypartController _daypart;

  @override
  void initState() {
    super.initState();
    _daypart = DaypartController()..start();
  }

  @override
  void dispose() {
    _daypart.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DaypartScope(
      controller: _daypart,
      child: ListenableBuilder(
        listenable: _daypart,
        builder: (context, _) {
          return MaterialApp(
            title: BevelConfig.appName,
            debugShowCheckedModeBanner: false,
            theme: buildBevelTheme(_daypart.palette),
            home: const BevelHomePage(),
          );
        },
      ),
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
  final _googleNative = GoogleNativeAuth();
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
  String? _lastAuthCompleteCode;
  DateTime? _lastAuthCompleteAt;

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

      // Signed-in: open last selected space, or the chooser (Private + orgs).
      if (!_didAutoOpenWorkspace &&
          (onboarding.completedGoogleSignIn || onboarding.sessionHealthy) &&
          !onboarding.needsOnboarding) {
        _didAutoOpenWorkspace = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || _workspaceOpen) return;
          if (onboarding.selectedWorkspace != null) {
            _openSelectedSpace();
          } else {
            _openWorkspacePicker(autoEnterIfSingle: false);
          }
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
        final code = action.handoffCode ?? '';
        final now = DateTime.now();
        if (code.isNotEmpty &&
            code == _lastAuthCompleteCode &&
            _lastAuthCompleteAt != null &&
            now.difference(_lastAuthCompleteAt!) < const Duration(seconds: 20)) {
          return;
        }
        _lastAuthCompleteCode = code;
        _lastAuthCompleteAt = now;
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

    // Prefer host from OAuth (org) when present; else selected space / chooser.
    if (workspaceHost != null && workspaceHost.trim().isNotEmpty) {
      final host = workspaceHost.trim().toLowerCase();
      final isApex = host == 'bevel.is' ||
          host == 'www.bevel.is' ||
          host == 'app.bevel.is';
      final target = isApex
          ? WorkspaceTarget.private(platformHost: host)
          : WorkspaceTarget.org(
              slug: host.split('.').firstWhere(
                    (s) => s != 'bevel' && s.isNotEmpty,
                    orElse: () => host,
                  ),
              name: host,
              host: host,
              homePath: safePath.startsWith('/me') ? '/me' : safePath,
            );
      final nextWs = _onboarding.copyWith(selectedWorkspace: target);
      await nextWs.save();
      if (!mounted) return;
      setState(() => _onboarding = nextWs);
      _openWorkspace(
        path: safePath,
        handoffCode: handoffCode,
        workspaceHost: host,
      );
      return;
    }

    if (_onboarding.selectedWorkspace != null) {
      _openSelectedSpace(handoffCode: handoffCode);
    } else {
      _openWorkspacePicker(autoEnterIfSingle: true);
    }
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
      builder: (ctx) {
        final p = ctx.bevel;
        return AlertDialog(
          backgroundColor: p.surfaceRaised,
          title: Text(
            'Stay on top of escalations',
            style: TextStyle(color: p.ink, fontWeight: FontWeight.w600),
          ),
          content: Text(
            'When someone writes ^yourhandle, BEVEL needs permission to '
            'interrupt you — louder than a soft @mention. Enable notifications?',
            style: TextStyle(color: p.muted, height: 1.45),
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
        );
      },
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

  void _openWorkspacePicker({bool autoEnterIfSingle = false}) {
    Navigator.of(context)
        .push(
      MaterialPageRoute<void>(
        builder: (_) => WorkspacePickerPage(
          email: _onboarding.userEmail.isNotEmpty
              ? _onboarding.userEmail
              : null,
          selectedId: _onboarding.selectedWorkspace?.id,
          onSelect: (target) async {
            Navigator.of(context).pop(); // close picker
            await _selectAndOpenSpace(target);
          },
        ),
      ),
    )
        .then((_) {
      // no-op
    });
    // autoEnterIfSingle reserved for future single-membership UX
    if (autoEnterIfSingle) {
      // Keep chooser — always let user pick Private vs org explicitly.
    }
  }

  Future<void> _selectAndOpenSpace(WorkspaceTarget target) async {
    final home = target.homePath;
    final next = _onboarding.copyWith(
      selectedWorkspace: target,
      lastWorkspacePath: home,
    );
    await next.save();
    if (!mounted) return;
    setState(() {
      _onboarding = next;
      _status = 'Opening ${target.name}…';
    });
    // Pop shell if already open, then open new host
    if (_workspaceOpen && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      await Future<void>.delayed(const Duration(milliseconds: 80));
    }
    if (!mounted) return;
    _openWorkspace(
      path: home,
      workspaceHost: target.host,
    );
  }

  void _openSelectedSpace({String? handoffCode, String? pathOverride}) {
    final ws = _onboarding.selectedWorkspace;
    if (ws == null) {
      _openWorkspacePicker();
      return;
    }
    final path = pathOverride ??
        (_onboarding.lastWorkspacePath.isNotEmpty &&
                _pathMatchesSpace(_onboarding.lastWorkspacePath, ws)
            ? _onboarding.lastWorkspacePath
            : ws.homePath);
    _openWorkspace(
      path: path,
      handoffCode: handoffCode,
      workspaceHost: ws.host,
    );
  }

  bool _pathMatchesSpace(String path, WorkspaceTarget ws) {
    if (ws.isPrivate) {
      return path == '/me' || path.startsWith('/me/') || path.startsWith('/talk');
    }
    return path.startsWith('/~') ||
        path.startsWith('/bevel') ||
        path.startsWith('/timeline') ||
        path.startsWith('/talk');
  }

  void _openWorkspace({
    String path = '/~general',
    String? handoffCode,
    String? workspaceHost,
  }) {
    final selected = _onboarding.selectedWorkspace;
    final host = (workspaceHost != null && workspaceHost.isNotEmpty)
        ? workspaceHost
        : selected?.host;
    final openPath = path.isEmpty || path == '/'
        ? (selected?.homePath ??
            (_onboarding.lastWorkspacePath.isNotEmpty
                ? _onboarding.lastWorkspacePath
                : '/~general'))
        : path;
    _workspaceOpen = true;
    Navigator.of(context)
        .push(
      MaterialPageRoute<void>(
        builder: (_) => WorkspaceShellPage(
          initialPath: openPath,
          handoffCode: handoffCode,
          workspaceHost: host,
          workspaceLabel: selected?.name,
          hermes: _hermes,
          consumerMode: true,
          onOpenNativeHub: () => _openNativeHub(),
          onOpenNotifications: _openNotificationSettings,
          onSwitchWorkspace: () {
            Navigator.of(context).pop(); // leave shell
            _openWorkspacePicker();
          },
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
                  ? 'Session ready · ${selected?.name ?? host ?? 'chat'}'
                  : 'Needs sign-in — use the login button if stuck';
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
    setState(() => _status = 'Continue with Google…');
    // Silicon Mac: Workspace login matches the web app (system browser +
    // Auth.js). Native Google Sign-In needs an iOS-type client that we only
    // wire for iPhone unless GOOGLE_IOS_CLIENT_ID is set.
    final preferBrowser = defaultTargetPlatform == TargetPlatform.macOS &&
        !GoogleNativeAuth().hasIosClientConfigured;
    if (preferBrowser) {
      final ok = await _oauth.openSystemLogin();
      if (!mounted) return;
      setState(() {
        _status = ok
            ? 'Finish Google Workspace in the browser — we will bring you back.'
            : 'Could not open Google sign-in';
      });
      return;
    }
    try {
      // Prefer native Google Sign-In SDK (in-app account sheet).
      final selected = _onboarding.selectedWorkspace;
      final tenant = selected?.slug ??
          (selected?.isPrivate == true ? '2x4m' : '2x4m');
      final path = selected?.homePath ??
          (_onboarding.lastWorkspacePath.isNotEmpty
              ? _onboarding.lastWorkspacePath
              : '/~general');
      final host = selected?.host ??
          Uri.parse(BevelConfig.workspaceUrl).host;

      final result = await _googleNative.signIn(
        tenantSlug: tenant,
        callbackPath: path,
        workspaceHost: host,
      );
      if (!mounted) return;
      if (result == null) {
        setState(() => _status = 'Sign-in cancelled');
        return;
      }
      setState(() => _status = 'Signed in as ${result.email}');
      await _onAuthComplete(
        result.callbackPath ?? path,
        email: result.email,
        userId: result.userId,
        userName: result.name,
        handoffCode: result.handoffCode,
        workspaceHost: result.workspaceHost ?? host,
      );
      return;
    } catch (e) {
      debugPrint('Native Google sign-in failed: $e');
      if (!mounted) return;
      final msg = e.toString();
      // WEB client misconfigured as iOS → Google Error 400 custom scheme
      final needsIosClient = msg.contains('GOOGLE_IOS_CLIENT_ID') ||
          msg.contains('WEB') ||
          msg.contains('custom scheme') ||
          msg.contains('invalid_request');
      if (needsIosClient &&
          defaultTargetPlatform == TargetPlatform.iOS) {
        setState(() {
          _status =
              'Need an iOS OAuth client (not WEB). See scripts/mobile/apply-google-ios-client.sh';
        });
        if (mounted) {
          await showDialog<void>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Google iOS client required'),
              content: const Text(
                'Google blocked sign-in because a WEB OAuth client was used '
                'for native iOS (custom schemes are not allowed).\n\n'
                'Create OAuth client type iOS in Cloud Console (2x4m project) '
                'with bundle id com.derozic.bevel.bevelApp, then run:\n\n'
                './scripts/mobile/apply-google-ios-client.sh <client-id>\n\n'
                'You can continue with browser sign-in for now.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Use browser'),
                ),
              ],
            ),
          );
        }
      } else {
        setState(() {
          _status =
              'Native Google sign-in failed — falling back to system browser…';
        });
      }
    }

    // Fallback: system browser OAuth (legacy)
    final ok = await _oauth.openSystemLogin();
    if (!mounted) return;
    if (!ok) {
      setState(() => _status = 'Could not open sign-in');
      return;
    }
    setState(() {
      _status =
          'Finish Google in the browser, then we will return you to the app.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final caps = _caps;
    final isMac = caps?.platformLabel == 'macos';
    final hermesLabel = _hermesStatus?.summary;
    final layout = BevelLayoutInfo.of(context);
    final ctrl = context.daypart;

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
    final selected = _onboarding.selectedWorkspace;

    return AdaptiveScaffold(
      backgroundColor: p.cream,
      appBar: AppBar(
        title: const BevelBrandTitle(),
        actions: [
          IconButton(
            tooltip: 'Choose workspace',
            onPressed: () => _openWorkspacePicker(),
            icon: const Icon(Icons.workspaces_outlined),
          ),
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
                case 'spaces':
                  _openWorkspacePicker();
                case 'hub':
                  _openNativeHub();
                case 'hermes':
                  await _openHermes();
                case 'copy':
                  final url = selected?.origin ?? BevelConfig.workspaceUrl;
                  await Clipboard.setData(ClipboardData(text: url));
                  if (mounted) {
                    setState(() => _status = 'Copied $url');
                  }
                case 'browser':
                  await _openExternal(BevelConfig.entryUri());
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'spaces',
                child: Text('Switch workspace'),
              ),
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
      body: signedIn
          ? _signedInHome(
              context,
              p: p,
              layout: layout,
              ctrl: ctrl,
              selected: selected,
              hermesLabel: hermesLabel,
              isMac: isMac,
              caps: caps,
            )
          : BevelAuthShell(
              footer: Text(
                'v${BevelConfig.versionLabel}'
                '${caps != null ? ' · ${caps.platformLabel}' : ''}',
                style: TextStyle(fontSize: 11, color: p.subtle),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: BevelMark(size: 36)),
                  const SizedBox(height: 14),
                  const Center(child: BevelWordmark(size: BevelWordmarkSize.lg)),
                  const SizedBox(height: 18),
                  Text(
                    BevelConfig.appTagline,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isMac
                        ? 'Sign in with Google Workspace in the browser, then choose Private or a workspace.'
                        : 'Sign in with Google Workspace, then choose Private or an org.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 24),
                  Semantics(
                    identifier: 'bevel.home.continue_google',
                    button: true,
                    label: 'Continue with Google',
                    child: FilledButton.icon(
                      onPressed: _continueWithGoogle,
                      icon: const Icon(Icons.login_rounded),
                      label: const Text('Continue with Google'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Semantics(
                    identifier: 'bevel.home.open_workspace',
                    button: true,
                    label: 'Choose workspace',
                    child: OutlinedButton.icon(
                      onPressed: () => _openWorkspacePicker(),
                      icon: const Icon(Icons.workspaces_outlined),
                      label: const Text('Choose workspace'),
                    ),
                  ),
                  if (_status != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _status!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: p.accent, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _signedInHome(
    BuildContext context, {
    required BevelPalette p,
    required BevelLayoutInfo layout,
    required DaypartController? ctrl,
    required WorkspaceTarget? selected,
    required String? hermesLabel,
    required bool isMac,
    required NativeCapabilities? caps,
  }) {
    return BevelAtmosphere(
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: layout.contentMaxWidth.clamp(280, 720),
          ),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              layout.isFoldCover ? 16 : 24,
              layout.isFoldCover ? 16 : 24,
              layout.isFoldCover ? 16 : 24,
              40,
            ),
            children: [
              Text(
                'Your spaces',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                ctrl?.meta.greeting ??
                    'Pick Private or a product workspace.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              if (_onboarding.userEmail.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  _onboarding.userName.isNotEmpty
                      ? '${_onboarding.userName} · ${_onboarding.userEmail}'
                      : _onboarding.userEmail,
                  style: TextStyle(color: p.muted, fontSize: 13),
                ),
              ],
              if (selected != null) ...[
                const SizedBox(height: 20),
                BevelHairlineCard(
                  highlighted: true,
                  onTap: _openSelectedSpace,
                  child: Row(
                    children: [
                      Icon(
                        selected.isPrivate
                            ? Icons.lock_outline_rounded
                            : Icons.workspaces_outlined,
                        color: p.accent,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              selected.name,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: p.ink,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              selected.subtitle ?? selected.host,
                              style: TextStyle(color: p.muted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: p.subtle),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
              Semantics(
                identifier: 'bevel.home.open_workspace',
                button: true,
                label: selected != null
                    ? 'Continue to ${selected.name}'
                    : 'Choose workspace',
                child: FilledButton.icon(
                  onPressed: selected != null
                      ? _openSelectedSpace
                      : () => _openWorkspacePicker(),
                  icon: Icon(
                    selected != null
                        ? Icons.forum_outlined
                        : Icons.workspaces_outlined,
                  ),
                  label: Text(
                    selected != null
                        ? 'Continue to ${selected.name}'
                        : 'Choose workspace',
                  ),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => _openWorkspacePicker(),
                icon: const Icon(Icons.swap_horiz_rounded, size: 18),
                label: const Text('Switch workspace'),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: _continueWithGoogle,
                icon: const Icon(Icons.login_rounded, size: 18),
                label: const Text('Re-authenticate'),
              ),
              const SizedBox(height: 28),
              const BevelDaypartControl(),
              const SizedBox(height: 20),
              Text(
                'Private is bevel.is agents. Orgs are product hosts. '
                'Console stays on the web.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (hermesLabel != null && isMac) ...[
                const SizedBox(height: 20),
                BevelHairlineCard(
                  onTap: () => _openNativeHub(focusHermes: true),
                  child: Row(
                    children: [
                      Icon(
                        _hermesStatus?.serveOnline == true
                            ? Icons.check_circle_outline
                            : Icons.auto_awesome_outlined,
                        color: p.accent,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Hermes Desktop',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: p.ink,
                              ),
                            ),
                            Text(
                              hermesLabel,
                              style: TextStyle(color: p.muted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: p.subtle),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
              Text(
                'v${BevelConfig.versionLabel}'
                '${caps != null ? ' · ${caps.platformLabel}' : ''}'
                '${_lastDeepLink != null ? '\nLast link: $_lastDeepLink' : ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (_status != null) ...[
                const SizedBox(height: 12),
                Text(
                  _status!,
                  style: TextStyle(color: p.accent, fontSize: 13),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

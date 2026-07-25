import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../native/deep_links.dart';
import '../native/health_service.dart';
import '../native/hermes_bridge.dart';
import '../native/media_device_discovery.dart';
import '../native/native_capabilities.dart';
import '../native/notification_service.dart';
import '../native/sharing_service.dart';

/// Deep native integrations surface — sharing, Health, notifications, Hermes, standards.
class NativeHubPage extends StatefulWidget {
  const NativeHubPage({
    super.key,
    required this.capabilities,
    required this.sharing,
    required this.health,
    required this.notifications,
    this.hermes,
    this.initialHermesStatus,
    this.focusHermes = false,
    this.onHermesStatus,
  });

  final NativeCapabilities capabilities;
  final SharingService sharing;
  final HealthService health;
  final NotificationService notifications;
  final HermesBridge? hermes;
  final HermesBridgeStatus? initialHermesStatus;
  final bool focusHermes;
  final ValueChanged<HermesBridgeStatus>? onHermesStatus;

  @override
  State<NativeHubPage> createState() => _NativeHubPageState();
}

class _NativeHubPageState extends State<NativeHubPage> {
  String? _status;
  int? _steps;
  bool _healthAuthed = false;
  bool _notifAuthed = false;
  HermesBridgeStatus? _hermesStatus;
  MediaDeviceInventory? _mediaDevices;
  final _discovery = MediaDeviceDiscovery();
  final _hermesKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _hermesStatus = widget.initialHermesStatus;
    if (widget.focusHermes) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _hermesKey.currentContext;
        if (ctx != null) {
          Scrollable.ensureVisible(
            ctx,
            duration: const Duration(milliseconds: 280),
            alignment: 0.1,
          );
        }
      });
    }
  }

  Future<void> _setStatus(String msg) async {
    if (!mounted) return;
    setState(() => _status = msg);
  }

  Future<void> _probeHermes() async {
    final bridge = widget.hermes;
    if (bridge == null) return;
    final status = await bridge.probe();
    widget.onHermesStatus?.call(status);
    if (!mounted) return;
    setState(() {
      _hermesStatus = status;
      _status = status.summary;
    });
  }

  Future<void> _openHermes({String surface = 'desktop'}) async {
    final bridge = widget.hermes;
    if (bridge == null) return;
    final base = Uri.parse(BevelConfig.baseUrl);
    final handoff = bridge.handoffForWorkspace(
      workspaceUrl: BevelConfig.baseUrl,
      tenant: base.host.contains('2x4m') ? '2x4m' : null,
      channel: 'general',
      mode: surface == 'cli-query' ? 'brief' : 'orchestrate',
      surface: surface,
      prompt:
          'Opened from BEVEL Native Hub ($surface). '
          'Coordinate with fleet @hermes; use bevel-workspace skill. '
          'Return via bevel://hermes/return?channel=general when done.',
      successCriteria: 'Short status summary posted back to BEVEL',
    );
    final result = await bridge.openWithHandoff(handoff);
    if (!mounted) return;
    setState(() => _status = result.message);
  }

  Future<void> _shareWorkspace() async {
    final result = await widget.sharing.shareWorkspace(
      title: '${BevelConfig.appName} workspace',
      text: 'Join me on ${BevelConfig.appName}',
      uri: BevelConfig.workspaceUri(),
    );
    await _setStatus('Share: ${result.status.name}');
  }

  Future<void> _connectHealth() async {
    if (!widget.capabilities.supportsHealth) {
      await _setStatus('Health APIs unavailable on this platform');
      return;
    }
    await widget.health.configure();
    final ok = await widget.health.requestAuthorization();
    final steps = ok ? await widget.health.stepsLast24Hours() : null;
    if (!mounted) return;
    setState(() {
      _healthAuthed = ok;
      _steps = steps;
      _status = ok
          ? 'Connected to ${widget.health.backendLabel}'
              '${steps != null ? ' · $steps steps (24h)' : ''}'
          : 'Health authorization denied or unavailable';
    });
  }

  Future<void> _enableNotifications() async {
    await widget.notifications.initialize();
    final ok = await widget.notifications.requestPermission();
    if (ok) {
      await widget.notifications.showWorkspaceAlert(
        id: 1,
        title: BevelConfig.appName,
        body: 'Notifications are on. Mentions and agent updates will land here.',
        payload: 'bevel://channel/product',
      );
    }
    if (!mounted) return;
    setState(() {
      _notifAuthed = ok;
      _status = ok ? 'Notifications authorized' : 'Notification permission denied';
    });
  }

  Future<void> _discoverMediaDevices() async {
    if (!widget.capabilities.supportsDeviceDiscovery) {
      await _setStatus(
        'Device discovery needs the Silicon Mac app (not browser install)',
      );
      return;
    }
    await _setStatus('Requesting mic access + scanning devices…');
    await _discovery.requestAccess(camera: true);
    final inventory = await _discovery.enumerate();
    if (!mounted) return;
    setState(() {
      _mediaDevices = inventory;
      _status = inventory.error ??
          'Huddle-ready: ${inventory.summary}'
              '${inventory.microphones.isNotEmpty ? ' · default mic: ${inventory.microphones.where((d) => d.isDefault).map((d) => d.label).firstOrNull ?? inventory.microphones.first.label}' : ''}';
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.capabilities;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Native integrations'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
        children: [
          Text(
            'Deep OS integration',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Sharing, ${c.supportsHealthKit ? 'Apple HealthKit' : c.supportsHealthConnect ? 'Health Connect' : 'Health'}, '
            'notifications, Hermes Desktop, media device discovery for audio huddles, '
            'deep links — computer integration the browser install cannot match.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF9AA8B5),
                  height: 1.45,
                ),
          ),
          const SizedBox(height: 20),
          _ActionCard(
            title: 'Magenta Extensions',
            subtitle:
                'Remote marketing and product payloads (Preso slides, Bevel teaser, CYAN) '
                'via Magenta snippet / Flutter SDK — no app store release for each campaign.',
            icon: Icons.extension_outlined,
            enabled: true,
            actionLabel: 'Open settings',
            trailing: 'site_id=bevel',
            onAction: () async {
              final uri = Uri.parse(BevelConfig.magentaSettingsUrl);
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
                await _setStatus('Opened Magenta Extensions settings');
              } else {
                await _setStatus('Could not open ${BevelConfig.magentaSettingsUrl}');
              }
            },
          ),
          const SizedBox(height: 12),
          _ActionCard(
            title: 'Magenta admin catalog',
            subtitle: 'Create or enable extension payloads for partner sites.',
            icon: Icons.dashboard_customize_outlined,
            enabled: true,
            actionLabel: 'Open catalog',
            onAction: () async {
              final uri = Uri.parse(BevelConfig.magentaExtensionsAdminUrl);
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
          ),
          const SizedBox(height: 20),
          if (c.supportsDeviceDiscovery) ...[
            _ActionCard(
              title: 'Audio huddles · device discovery',
              subtitle:
                  'Scan CoreAudio + AVFoundation for mics, speakers, and cameras. '
                  'Native Silicon discovery is the prerequisite for reliable huddles '
                  '(browser install cannot do this cleanly).',
              icon: Icons.headphones_outlined,
              enabled: true,
              actionLabel: _mediaDevices == null
                  ? 'Discover devices'
                  : 'Re-scan devices',
              trailing: _mediaDevices?.summary,
              onAction: _discoverMediaDevices,
            ),
            if (_mediaDevices != null && !_mediaDevices!.isEmpty) ...[
              const SizedBox(height: 8),
              _CapabilityCard(
                title: 'Discovered media',
                lines: [
                  ..._mediaDevices!.microphones.take(4).map(
                        (d) =>
                            'Mic${d.isDefault ? ' *' : ''}: ${d.label}',
                      ),
                  ..._mediaDevices!.speakers.take(3).map(
                        (d) =>
                            'Out${d.isDefault ? ' *' : ''}: ${d.label}',
                      ),
                  ..._mediaDevices!.cameras.take(3).map(
                        (d) =>
                            'Cam${d.isDefault ? ' *' : ''}: ${d.label}',
                      ),
                ],
                icon: Icons.mic_none_rounded,
                accent: scheme.primary,
              ),
            ],
            const SizedBox(height: 12),
          ],
          if (c.supportsHermesBridge && widget.hermes != null) ...[
            Semantics(
              identifier: 'bevel.hub.hermes_card',
              container: true,
              label: 'Hermes Desktop connection',
              child: Card(
                key: _hermesKey,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.auto_awesome_outlined, color: scheme.primary),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Text(
                              'Hermes Desktop',
                              style: TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                          if (_hermesStatus?.serveOnline == true)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: scheme.primary.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                'serve',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: scheme.primary,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _hermesStatus?.summary ??
                            'Not probed yet — detect Hermes.app, CLI, and local gateway.',
                        style: const TextStyle(
                          color: Color(0xFF9AA8B5),
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                      if (_hermesStatus?.appBundlePath != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          _hermesStatus!.appBundlePath!,
                          style: const TextStyle(
                            color: Color(0xFF6B7A88),
                            fontSize: 11,
                          ),
                        ),
                      ],
                      if (_hermesStatus?.cliPath != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          'CLI: ${_hermesStatus!.cliPath}',
                          style: const TextStyle(
                            color: Color(0xFF6B7A88),
                            fontSize: 11,
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        children: [
                          Semantics(
                            identifier: 'bevel.hub.hermes_probe',
                            button: true,
                            label: 'Re-probe Hermes',
                            child: OutlinedButton(
                              onPressed: _probeHermes,
                              child: const Text('Probe'),
                            ),
                          ),
                          Semantics(
                            identifier: 'bevel.hub.hermes_open',
                            button: true,
                            label: 'Launch Hermes Desktop',
                            child: FilledButton.tonal(
                              onPressed: () => _openHermes(surface: 'desktop'),
                              child: const Text('Desktop'),
                            ),
                          ),
                          Semantics(
                            identifier: 'bevel.hub.hermes_cli',
                            button: true,
                            label: 'Launch Hermes CLI in Terminal',
                            child: OutlinedButton(
                              onPressed: () => _openHermes(surface: 'cli'),
                              child: const Text('CLI'),
                            ),
                          ),
                          Semantics(
                            identifier: 'bevel.hub.hermes_cli_query',
                            button: true,
                            label: 'Run Hermes single-query CLI',
                            child: OutlinedButton(
                              onPressed: () =>
                                  _openHermes(surface: 'cli-query'),
                              child: const Text('CLI -q'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Desktop: hermes desktop --cwd · App: com.nousresearch.hermes\n'
                        'CLI: hermes -s bevel-workspace (Terminal) · chat -q for one shot\n'
                        'Shared state: ~/.hermes · Resume: hermes -c · Skill slash: /bevel-workspace\n'
                        'Probe: serve :9119 · messaging gateway :8642 · Return: bevel://hermes/return',
                        style: TextStyle(
                          color: Color(0xFF6B7A88),
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          _CapabilityCard(
            title: 'Device',
            lines: [
              '${c.platformLabel} · ${c.deviceModel}',
              c.osVersion,
              'v${c.appVersion}+${c.buildNumber}'
                  '${c.isAppleSiliconMac ? ' · Apple Silicon' : ''}',
            ],
            icon: Icons.phone_iphone_rounded,
            accent: scheme.primary,
          ),
          const SizedBox(height: 12),
          _ActionCard(
            title: 'System share',
            subtitle:
                'UIActivityViewController / Android share sheet for invites, '
                'channel links, and agent transcripts',
            icon: Icons.ios_share_rounded,
            enabled: c.supportsShare,
            actionLabel: 'Share workspace',
            onAction: _shareWorkspace,
          ),
          const SizedBox(height: 12),
          _ActionCard(
            title: c.supportsHealthKit
                ? 'Apple HealthKit'
                : c.supportsHealthConnect
                    ? 'Google Health Connect'
                    : 'Health APIs',
            subtitle:
                'Steps, heart rate, sleep, workouts — user-gated for presence '
                'sentience and wellness agents. No clinical claims.',
            icon: Icons.favorite_outline_rounded,
            enabled: c.supportsHealth,
            actionLabel: _healthAuthed ? 'Refresh health' : 'Connect health',
            trailing: _steps != null ? '$_steps steps' : null,
            onAction: _connectHealth,
          ),
          const SizedBox(height: 12),
          _ActionCard(
            title: 'Notifications',
            subtitle:
                'Local alerts now; APNs / FCM device tokens for remote push '
                'when the control plane is wired',
            icon: Icons.notifications_active_outlined,
            enabled: c.supportsNotifications,
            actionLabel:
                _notifAuthed ? 'Send test alert' : 'Enable notifications',
            onAction: _enableNotifications,
          ),
          const SizedBox(height: 12),
          _CapabilityCard(
            title: 'Deep links',
            lines: [
              'Custom scheme: bevel://channel/{id}',
              'Hermes: bevel://hermes/open|return|status',
              'Universal / App Links: workspace hosts',
              'Route helper: ${DeepLinkService.routeFor(Uri.parse('bevel://channel/product'))}',
            ],
            icon: Icons.link_rounded,
            accent: scheme.primary,
          ),
          const SizedBox(height: 12),
          _CapabilityCard(
            title: 'Platform standards',
            lines: const [
              'Adaptive icons + Icon Composer layered mark',
              'Privacy usage strings (Health, Notifications)',
              'Safe areas, dark chrome, Material 3 / Cupertino cues',
              'App Links / associated domains (configure in store)',
            ],
            icon: Icons.verified_outlined,
            accent: scheme.primary,
          ),
          if (_status != null) ...[
            const SizedBox(height: 20),
            SelectableText(
              _status!,
              style: TextStyle(color: scheme.primary, fontSize: 13, height: 1.4),
            ),
          ],
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(
                const ClipboardData(
                  text: 'https://github.com/derozic/bevel/blob/main/docs/NATIVE_INTEGRATIONS.md',
                ),
              );
              await _setStatus('Docs path copied');
            },
            icon: const Icon(Icons.menu_book_outlined, size: 18),
            label: const Text('Native integrations docs'),
          ),
        ],
      ),
    );
  }
}

class _CapabilityCard extends StatelessWidget {
  const _CapabilityCard({
    required this.title,
    required this.lines,
    required this.icon,
    required this.accent,
  });

  final String title;
  final List<String> lines;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: accent),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  ...lines.map(
                    (l) => Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        l,
                        style: const TextStyle(
                          color: Color(0xFF9AA8B5),
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.enabled,
    required this.actionLabel,
    required this.onAction,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool enabled;
  final String actionLabel;
  final VoidCallback onAction;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: enabled ? scheme.primary : Colors.grey),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (trailing != null)
                  Text(
                    trailing!,
                    style: TextStyle(
                      color: scheme.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: const TextStyle(
                color: Color(0xFF9AA8B5),
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: enabled ? onAction : null,
              child: Text(actionLabel),
            ),
          ],
        ),
      ),
    );
  }
}

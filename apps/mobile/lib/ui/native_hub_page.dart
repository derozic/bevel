import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../config.dart';
import '../native/deep_links.dart';
import '../native/health_service.dart';
import '../native/native_capabilities.dart';
import '../native/notification_service.dart';
import '../native/sharing_service.dart';

/// Deep native integrations surface — sharing, Health, notifications, standards.
class NativeHubPage extends StatefulWidget {
  const NativeHubPage({
    super.key,
    required this.capabilities,
    required this.sharing,
    required this.health,
    required this.notifications,
  });

  final NativeCapabilities capabilities;
  final SharingService sharing;
  final HealthService health;
  final NotificationService notifications;

  @override
  State<NativeHubPage> createState() => _NativeHubPageState();
}

class _NativeHubPageState extends State<NativeHubPage> {
  String? _status;
  int? _steps;
  bool _healthAuthed = false;
  bool _notifAuthed = false;

  Future<void> _setStatus(String msg) async {
    if (!mounted) return;
    setState(() => _status = msg);
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
            'notifications, deep links, and platform standards — '
            'wired for award-tier mobile quality.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF9AA8B5),
                  height: 1.45,
                ),
          ),
          const SizedBox(height: 20),
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

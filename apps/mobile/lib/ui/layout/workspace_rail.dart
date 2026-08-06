import 'package:flutter/material.dart';

import '../../config.dart';

/// Native left rail for expanded layouts (iPad Pro, Fold inner, tablets).
class WorkspaceRail extends StatelessWidget {
  const WorkspaceRail({
    super.key,
    required this.activePath,
    required this.onNavigate,
    this.onOpenTimeline,
    this.onOpenNativeHub,
    this.escalatedSlugs = const {},
    this.channels,
  });

  final String activePath;
  final void Function(String path) onNavigate;
  final VoidCallback? onOpenTimeline;
  final VoidCallback? onOpenNativeHub;
  final Set<String> escalatedSlugs;
  /// Live channel list `(slug, displayName)` from the workspace BFF when available.
  final List<(String, String)>? channels;

  static const _defaultChannels = <(String, String)>[
    ('general', 'General'),
    ('ops', 'Ops'),
    ('product', 'Product'),
  ];

  bool _isActive(String path) {
    final a = activePath.toLowerCase();
    final p = path.toLowerCase();
    return a == p || a.endsWith(p) || a.contains(p.replaceFirst('/', ''));
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 12, 8),
            child: Row(
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
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'BEVEL',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFF4F7F5),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Text(
              Uri.parse(BevelConfig.workspaceUrl).host,
              style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 8),
          _NavTile(
            icon: Icons.schedule_outlined,
            label: 'Timeline',
            subtitle: 'feed',
            selected: _isActive('/timeline'),
            onTap: () {
              if (onOpenTimeline != null) {
                onOpenTimeline!();
              } else {
                onNavigate('/timeline');
              }
            },
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 6),
            child: Text(
              'CHANNELS',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: Color(0xFF64748B),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                for (final (slug, name)
                    in (channels != null && channels!.isNotEmpty)
                        ? channels!
                        : _defaultChannels)
                  _NavTile(
                    icon: escalatedSlugs.contains(slug)
                        ? Icons.priority_high_rounded
                        : Icons.tag_rounded,
                    label: escalatedSlugs.contains(slug) ? '^$slug' : '~$slug',
                    subtitle: name,
                    selected: _isActive('/~$slug') || _isActive('/bevel/$slug'),
                    escalated: escalatedSlugs.contains(slug),
                    onTap: () => onNavigate('/~$slug'),
                  ),
              ],
            ),
          ),
          if (onOpenNativeHub != null)
            _NavTile(
              icon: Icons.hub_outlined,
              label: 'Native hub',
              subtitle: 'integrations',
              selected: false,
              onTap: onOpenNativeHub!,
            ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.selected,
    required this.onTap,
    this.escalated = false,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final bool selected;
  final bool escalated;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: selected
            ? scheme.primary.withValues(alpha: 0.12)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: escalated
                      ? const Color(0xFFFBBF24)
                      : selected
                          ? scheme.primary
                          : const Color(0xFF94A3B8),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: escalated
                              ? const Color(0xFFFBBF24)
                              : const Color(0xFFF4F7F5),
                          fontFamily: label.startsWith('~') || label.startsWith('^')
                              ? 'monospace'
                              : null,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

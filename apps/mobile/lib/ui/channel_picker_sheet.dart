import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// Phone/narrow layout channel + destination picker (parity with tablet rail).
class ChannelPickerSheet extends StatelessWidget {
  const ChannelPickerSheet({
    super.key,
    required this.channels,
    required this.activePath,
    required this.onSelectPath,
    this.onOpenTimeline,
    this.onOpenNotifications,
  });

  final List<(String, String)> channels;
  final String activePath;
  final void Function(String path) onSelectPath;
  final VoidCallback? onOpenTimeline;
  final VoidCallback? onOpenNotifications;

  static Future<void> show(
    BuildContext context, {
    required List<(String, String)> channels,
    required String activePath,
    required void Function(String path) onSelectPath,
    VoidCallback? onOpenTimeline,
    VoidCallback? onOpenNotifications,
  }) {
    final p = context.bevel;
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: p.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (ctx) => ChannelPickerSheet(
        channels: channels,
        activePath: activePath,
        onSelectPath: (path) {
          Navigator.of(ctx).pop();
          onSelectPath(path);
        },
        onOpenTimeline: onOpenTimeline == null
            ? null
            : () {
                Navigator.of(ctx).pop();
                onOpenTimeline();
              },
        onOpenNotifications: onOpenNotifications == null
            ? null
            : () {
                Navigator.of(ctx).pop();
                onOpenNotifications();
              },
      ),
    );
  }

  bool _isActive(String path) {
    final a = activePath.toLowerCase();
    final p = path.toLowerCase();
    return a == p || a.endsWith(p) || a.contains(p.replaceFirst('/', ''));
  }

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final list = channels.isNotEmpty
        ? channels
        : const <(String, String)>[
            ('general', 'General'),
            ('ops', 'Ops'),
            ('product', 'Product'),
          ];

    return SafeArea(
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.55,
        minChildSize: 0.35,
        maxChildSize: 0.9,
        builder: (context, scrollController) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 8),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: p.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Text(
                  'Channels',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: p.ink,
                  ),
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                  children: [
                    if (onOpenTimeline != null)
                      ListTile(
                        leading: Icon(
                          Icons.schedule_outlined,
                          color: _isActive('/timeline') ? p.accent : p.muted,
                        ),
                        title: Text(
                          'Timeline',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: p.ink,
                          ),
                        ),
                        subtitle: Text(
                          'Mentions and escalations',
                          style: TextStyle(color: p.subtle),
                        ),
                        selected: _isActive('/timeline'),
                        onTap: onOpenTimeline,
                      ),
                    if (onOpenNotifications != null)
                      ListTile(
                        leading: Icon(
                          Icons.notifications_outlined,
                          color: p.muted,
                        ),
                        title: Text(
                          'Notification settings',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: p.ink,
                          ),
                        ),
                        onTap: onOpenNotifications,
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                      child: Text(
                        'WORKSPACE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.0,
                          color: p.subtle,
                        ),
                      ),
                    ),
                    for (final (slug, name) in list)
                      ListTile(
                        leading: Icon(
                          Icons.tag_rounded,
                          color: _isActive('/~$slug') ? p.accent : p.muted,
                        ),
                        title: Text(
                          '~$slug',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontFamily: 'monospace',
                            color: _isActive('/~$slug') ? p.accent : p.ink,
                          ),
                        ),
                        subtitle: Text(
                          name,
                          style: TextStyle(color: p.subtle),
                        ),
                        selected: _isActive('/~$slug'),
                        onTap: () => onSelectPath('/~$slug'),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                      child: Text(
                        'AGENTS',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.0,
                          color: p.subtle,
                        ),
                      ),
                    ),
                    ListTile(
                      leading: Icon(
                        Icons.auto_awesome_outlined,
                        color: _isActive('/talk/hermes') ? p.accent : p.muted,
                      ),
                      title: Text(
                        'Hermes',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: p.ink,
                        ),
                      ),
                      subtitle: Text(
                        'Personal + fleet agent',
                        style: TextStyle(color: p.subtle),
                      ),
                      selected: _isActive('/talk/hermes'),
                      onTap: () => onSelectPath('/talk/hermes'),
                    ),
                    ListTile(
                      leading: Icon(
                        Icons.chat_bubble_outline,
                        color: _isActive('/me') ? p.accent : p.muted,
                      ),
                      title: Text(
                        'Private space',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: p.ink,
                        ),
                      ),
                      subtitle: Text(
                        'Your agents only',
                        style: TextStyle(color: p.subtle),
                      ),
                      selected: _isActive('/me'),
                      onTap: () => onSelectPath('/me'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

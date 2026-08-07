import 'package:flutter/material.dart';

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
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF0F1419),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
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
    final scheme = Theme.of(context).colorScheme;
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
                    color: const Color(0xFF334155),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Text(
                  'Channels',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFF4F7F5),
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
                          color: _isActive('/timeline')
                              ? scheme.primary
                              : const Color(0xFF94A3B8),
                        ),
                        title: const Text(
                          'Timeline',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFF4F7F5),
                          ),
                        ),
                        subtitle: const Text(
                          'Mentions and escalations',
                          style: TextStyle(color: Color(0xFF64748B)),
                        ),
                        selected: _isActive('/timeline'),
                        onTap: onOpenTimeline,
                      ),
                    if (onOpenNotifications != null)
                      ListTile(
                        leading: const Icon(
                          Icons.notifications_outlined,
                          color: Color(0xFF94A3B8),
                        ),
                        title: const Text(
                          'Notification settings',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFF4F7F5),
                          ),
                        ),
                        onTap: onOpenNotifications,
                      ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 12, 16, 6),
                      child: Text(
                        'WORKSPACE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ),
                    for (final (slug, name) in list)
                      ListTile(
                        leading: Icon(
                          Icons.tag_rounded,
                          color: _isActive('/~$slug')
                              ? scheme.primary
                              : const Color(0xFF94A3B8),
                        ),
                        title: Text(
                          '~$slug',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontFamily: 'monospace',
                            color: _isActive('/~$slug')
                                ? scheme.primary
                                : const Color(0xFFF4F7F5),
                          ),
                        ),
                        subtitle: Text(
                          name,
                          style: const TextStyle(color: Color(0xFF64748B)),
                        ),
                        selected: _isActive('/~$slug'),
                        onTap: () => onSelectPath('/~$slug'),
                      ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 12, 16, 6),
                      child: Text(
                        'AGENTS',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ),
                    ListTile(
                      leading: Icon(
                        Icons.auto_awesome_outlined,
                        color: _isActive('/talk/hermes')
                            ? scheme.primary
                            : const Color(0xFF94A3B8),
                      ),
                      title: const Text(
                        'Hermes',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFF4F7F5),
                        ),
                      ),
                      subtitle: const Text(
                        'Personal + fleet agent',
                        style: TextStyle(color: Color(0xFF64748B)),
                      ),
                      selected: _isActive('/talk/hermes'),
                      onTap: () => onSelectPath('/talk/hermes'),
                    ),
                    ListTile(
                      leading: Icon(
                        Icons.chat_bubble_outline,
                        color: _isActive('/me')
                            ? scheme.primary
                            : const Color(0xFF94A3B8),
                      ),
                      title: const Text(
                        'Private space',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFF4F7F5),
                        ),
                      ),
                      subtitle: const Text(
                        'Your agents only',
                        style: TextStyle(color: Color(0xFF64748B)),
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

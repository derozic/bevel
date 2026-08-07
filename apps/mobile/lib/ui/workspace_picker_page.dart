import 'package:flutter/material.dart';

import '../config.dart';
import '../workspace/workspace_catalog.dart';
import '../workspace/workspace_target.dart';

/// Chooser: top-level Private + product workspaces (parity with web /workspaces).
class WorkspacePickerPage extends StatefulWidget {
  const WorkspacePickerPage({
    super.key,
    this.email,
    this.selectedId,
    required this.onSelect,
  });

  final String? email;
  final String? selectedId;
  final void Function(WorkspaceTarget target) onSelect;

  @override
  State<WorkspacePickerPage> createState() => _WorkspacePickerPageState();
}

class _WorkspacePickerPageState extends State<WorkspacePickerPage> {
  final _catalog = WorkspaceCatalog();
  late Future<List<WorkspaceTarget>> _future;

  @override
  void initState() {
    super.initState();
    _future = _catalog.listForEmail(widget.email);
  }

  Future<void> _reload() async {
    setState(() {
      _future = _catalog.listForEmail(widget.email);
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final email = widget.email?.trim() ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      appBar: AppBar(
        title: const Text('Choose a space'),
        backgroundColor: const Color(0xFF0F1419),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _reload,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: FutureBuilder<List<WorkspaceTarget>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snap.data ?? [WorkspaceTarget.private()];
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              Text(
                'Where do you want to go?',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFFF4F7F5),
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                email.isNotEmpty
                    ? '$email — Private is always yours; product workspaces are memberships you enter on purpose.'
                    : 'Private is always yours; product workspaces are org memberships.',
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  height: 1.4,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 24),
              for (final t in items) ...[
                _SpaceCard(
                  target: t,
                  selected: widget.selectedId == t.id,
                  accent: scheme.primary,
                  onTap: () => widget.onSelect(t),
                ),
                const SizedBox(height: 12),
              ],
              const SizedBox(height: 8),
              Text(
                'Platform ${BevelConfig.baseUrl} · API ${BevelConfig.apiBaseUrl}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SpaceCard extends StatelessWidget {
  const _SpaceCard({
    required this.target,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final WorkspaceTarget target;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isPrivate = target.isPrivate;
    return Material(
      color: isPrivate
          ? accent.withValues(alpha: 0.08)
          : const Color(0xFF141A21),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected
                  ? accent
                  : (isPrivate
                      ? accent.withValues(alpha: 0.35)
                      : const Color(0xFF243040)),
            ),
          ),
          child: Row(
            children: [
              Icon(
                isPrivate
                    ? Icons.lock_outline_rounded
                    : Icons.workspaces_outlined,
                color: selected || isPrivate ? accent : const Color(0xFF94A3B8),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      target.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: Color(0xFFF4F7F5),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      target.subtitle ?? target.host,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                selected ? 'Current' : 'Enter',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: accent,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

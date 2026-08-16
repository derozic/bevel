import 'package:flutter/material.dart';

import '../config.dart';
import '../theme/theme.dart';
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
    final p = context.bevel;
    final email = widget.email?.trim() ?? '';

    return Scaffold(
      backgroundColor: p.cream,
      appBar: AppBar(
        title: const BevelBrandTitle(subtitle: 'Choose a space'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _reload,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: BevelAtmosphere(
        child: FutureBuilder<List<WorkspaceTarget>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return Center(
                child: CircularProgressIndicator(color: p.accent),
              );
            }
            final items = snap.data ?? [WorkspaceTarget.private()];
            return ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
              children: [
                Text(
                  'Where do you want to go?',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  email.isNotEmpty
                      ? '$email — Private is always yours; product workspaces are memberships you enter on purpose.'
                      : 'Private is always yours; product workspaces are org memberships.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 24),
                for (final t in items) ...[
                  _SpaceCard(
                    target: t,
                    selected: widget.selectedId == t.id,
                    onTap: () => widget.onSelect(t),
                  ),
                  const SizedBox(height: 12),
                ],
                const SizedBox(height: 16),
                const BevelDaypartControl(),
                const SizedBox(height: 16),
                Text(
                  'Platform ${BevelConfig.baseUrl}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SpaceCard extends StatelessWidget {
  const _SpaceCard({
    required this.target,
    required this.selected,
    required this.onTap,
  });

  final WorkspaceTarget target;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final isPrivate = target.isPrivate;
    return BevelHairlineCard(
      highlighted: selected || isPrivate,
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: (isPrivate ? p.accent : p.ink).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isPrivate
                  ? Icons.lock_outline_rounded
                  : Icons.workspaces_outlined,
              color: isPrivate || selected ? p.accent : p.muted,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  target.name,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    color: p.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  target.subtitle ?? target.host,
                  style: TextStyle(fontSize: 12, color: p.muted, height: 1.35),
                ),
              ],
            ),
          ),
          Text(
            selected ? 'Current' : 'Enter',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: p.accent,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

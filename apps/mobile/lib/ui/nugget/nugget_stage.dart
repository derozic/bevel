import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../layout/bevel_breakpoints.dart';
import 'nugget.dart';

/// Native surface for template/page nuggets.
///
/// Phone: replaces the main pane.
/// Tablet / fold inner / Duo: full-width beside (or instead of) the rail.
class NuggetStage extends StatelessWidget {
  const NuggetStage({
    super.key,
    required this.nugget,
    this.onClose,
    this.onOpenRelated,
  });

  final BevelNugget nugget;
  final VoidCallback? onClose;
  final ValueChanged<BevelNugget>? onOpenRelated;

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final info = BevelLayoutInfo.of(context);
    final wide = info.prefersSplit || nugget.resolvedPlacement == NuggetPlacement.page;

    return Material(
      color: p.cream,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.symmetric(
                horizontal: info.isFoldCover ? 8 : 16,
                vertical: 10,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${nugget.source} · ${nugget.scale.name}',
                      style: TextStyle(
                        fontSize: 11,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w700,
                        color: p.muted,
                      ),
                    ),
                  ),
                  if (onClose != null)
                    TextButton(onPressed: onClose, child: const Text('Close')),
                ],
              ),
            ),
            Divider(height: 1, color: p.border),
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: wide ? 920 : info.contentMaxWidth,
                  ),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
                    children: [
                      Text(
                        nugget.title,
                        style: TextStyle(
                          fontSize: wide ? 28 : 22,
                          fontWeight: FontWeight.w600,
                          color: p.ink,
                          height: 1.2,
                        ),
                      ),
                      if (nugget.summary != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          nugget.summary!,
                          style: TextStyle(color: p.muted, height: 1.45),
                        ),
                      ],
                      if (nugget.atoms.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final atom in nugget.atoms)
                              Chip(
                                label: Text(
                                  [
                                    if (atom.label != null) atom.label,
                                    if (atom.value != null) atom.value,
                                  ].join(' · '),
                                ),
                                visualDensity: VisualDensity.compact,
                              ),
                          ],
                        ),
                      ],
                      for (final section in nugget.sections) ...[
                        const SizedBox(height: 22),
                        Text(
                          section.title,
                          style: TextStyle(
                            fontSize: 12,
                            letterSpacing: 0.8,
                            fontWeight: FontWeight.w700,
                            color: p.accent,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          section.body,
                          style: TextStyle(color: p.ink, height: 1.5),
                        ),
                      ],
                      if (nugget.related.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        Text(
                          'Related',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: p.muted,
                          ),
                        ),
                        const SizedBox(height: 8),
                        for (final child in nugget.related)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text('Open ${child.scale.name}: ${child.title}'),
                            onTap: onOpenRelated == null
                                ? null
                                : () => onOpenRelated!(child),
                          ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

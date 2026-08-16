import 'package:flutter/material.dart';

import '../../theme/theme.dart';

/// Desktop-first auth frame: atmosphere fills the window, the panel does not.
///
/// Phone: the same card, inset. Mac: optical center, max 440, never
/// edge-to-edge. Matches the web login panel (rounded surface + hairline).
class BevelAuthShell extends StatelessWidget {
  const BevelAuthShell({
    super.key,
    required this.child,
    this.footer,
    this.maxWidth = 440,
  });

  final Widget child;
  final Widget? footer;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final wide = MediaQuery.sizeOf(context).width >= 720;
    final inset = wide ? 48.0 : 20.0;

    return BevelAtmosphere(
      child: SafeArea(
        child: Stack(
          children: [
            if (wide)
              const Positioned(
                top: 20,
                right: 24,
                child: BevelDaypartControl(),
              ),
            Center(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(inset, wide ? 56 : 24, inset, 28),
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: maxWidth),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: p.surface.withValues(alpha: 0.94),
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(color: p.border),
                          boxShadow: [
                            BoxShadow(
                              color: p.ink.withValues(alpha: 0.06),
                              blurRadius: 40,
                              offset: const Offset(0, 18),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(
                            wide ? 36 : 24,
                            wide ? 32 : 24,
                            wide ? 36 : 24,
                            wide ? 28 : 22,
                          ),
                          child: child,
                        ),
                      ),
                      if (footer != null) ...[
                        const SizedBox(height: 16),
                        footer!,
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

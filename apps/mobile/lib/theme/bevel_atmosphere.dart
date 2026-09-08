import 'package:flutter/material.dart';

import 'daypart.dart';
import 'daypart_controller.dart';

/// Soft radial wash behind native shells — same two-ellipse mesh as web.
class BevelAtmosphere extends StatelessWidget {
  const BevelAtmosphere({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    return DecoratedBox(
      decoration: BoxDecoration(color: p.cream),
      child: Stack(
        fit: StackFit.expand,
        children: [
          IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-0.85, -1.05),
                  radius: 1.15,
                  colors: [p.meshA, p.cream.withValues(alpha: 0)],
                ),
              ),
            ),
          ),
          IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.95, -0.85),
                  radius: 1.0,
                  colors: [p.meshB, p.cream.withValues(alpha: 0)],
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// Compact Auto / AM / Noon / PM / Eve control.
class BevelDaypartControl extends StatelessWidget {
  const BevelDaypartControl({super.key});

  @override
  Widget build(BuildContext context) {
    final ctrl = context.daypart;
    if (ctrl == null) return const SizedBox.shrink();
    final p = ctrl.palette;

    Widget chip(String label, bool active, VoidCallback onTap) {
      return GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: active ? p.ink : Colors.transparent,
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
              color: active ? p.cream : p.muted,
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Atmosphere',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.1,
            color: p.subtle,
          ),
        ),
        const SizedBox(height: 8),
        DecoratedBox(
          decoration: BoxDecoration(
            color: p.surface.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: p.border),
          ),
          child: Padding(
            padding: const EdgeInsets.all(3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                chip('Auto', ctrl.preference == DaypartPreference.auto,
                    () => ctrl.setPreference(DaypartPreference.auto)),
                chip('AM', ctrl.preference == DaypartPreference.morning,
                    () => ctrl.setPreference(DaypartPreference.morning)),
                chip('Noon', ctrl.preference == DaypartPreference.midday,
                    () => ctrl.setPreference(DaypartPreference.midday)),
                chip('PM', ctrl.preference == DaypartPreference.afternoon,
                    () => ctrl.setPreference(DaypartPreference.afternoon)),
                chip('Eve', ctrl.preference == DaypartPreference.night,
                    () => ctrl.setPreference(DaypartPreference.night)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${ctrl.meta.label} · ${ctrl.meta.hours}',
          style: TextStyle(fontSize: 11, color: p.subtle, height: 1.3),
        ),
      ],
    );
  }
}

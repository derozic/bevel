import 'package:flutter/material.dart';

import 'bevel_palette.dart';
import 'daypart_controller.dart';

/// Magenta bevel-mark geometry, colored from the active daypart.
class BevelMark extends StatelessWidget {
  const BevelMark({
    super.key,
    this.size = 28,
    this.palette,
  });

  final double size;
  final BevelPalette? palette;

  @override
  Widget build(BuildContext context) {
    final p = palette ?? context.bevel;
    return Semantics(
      label: 'BEVEL',
      child: CustomPaint(
        size: Size.square(size),
        painter: _BevelMarkPainter(p),
      ),
    );
  }
}

class _BevelMarkPainter extends CustomPainter {
  const _BevelMarkPainter(this.p);
  final BevelPalette p;

  @override
  void paint(Canvas canvas, Size size) {
    // Original SVG: viewBox 0 0 64 64, then translate(5 5) scale(3)
    // on 18x18 mark units.
    final scale = size.shortestSide / 64;
    canvas.save();
    canvas.scale(scale, scale);
    canvas.translate(5, 5);
    canvas.scale(3, 3);

    final left = Path()
      ..moveTo(2, 14.5)
      ..lineTo(2, 3.5)
      ..lineTo(7.5, 9)
      ..close();
    final face = Path()
      ..moveTo(2, 3.5)
      ..lineTo(16, 3.5)
      ..lineTo(9, 10.5)
      ..close();
    final right = Path()
      ..moveTo(16, 3.5)
      ..lineTo(16, 14.5)
      ..lineTo(9, 10.5)
      ..close();
    final glint = Path()
      ..moveTo(3.2, 4.4)
      ..lineTo(12.2, 4.4)
      ..lineTo(9.1, 8.0)
      ..lineTo(3.9, 5.1)
      ..close();
    final crease = Path()
      ..moveTo(8.65, 9.55)
      ..lineTo(9.35, 9.55)
      ..lineTo(9.12, 10.65)
      ..lineTo(8.88, 10.65)
      ..close();

    canvas.drawPath(left, Paint()..color = p.markLeft);
    canvas.drawPath(face, Paint()..color = p.markFace);
    canvas.drawPath(right, Paint()..color = p.markRight);
    canvas.drawPath(glint, Paint()..color = p.markGlint);
    canvas.drawPath(crease, Paint()..color = p.markCrease);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _BevelMarkPainter old) => old.p != p;
}

class BevelWordmark extends StatelessWidget {
  const BevelWordmark({
    super.key,
    this.size = BevelWordmarkSize.md,
    this.color,
    this.showTm = true,
  });

  final BevelWordmarkSize size;
  final Color? color;
  final bool showTm;

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final ink = color ?? p.ink;
    final (fontSize, tracking, tmSize) = switch (size) {
      BevelWordmarkSize.sm => (10.0, 2.2, 8.0),
      BevelWordmarkSize.md => (12.0, 2.8, 9.0),
      BevelWordmarkSize.lg => (14.0, 3.2, 10.0),
    };
    return Semantics(
      label: 'BEVEL',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'BEVEL',
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w600,
              letterSpacing: tracking,
              color: ink,
              height: 1.1,
            ),
          ),
          if (showTm)
            Padding(
              padding: const EdgeInsets.only(left: 1),
              child: Text(
                '™',
                style: TextStyle(
                  fontSize: tmSize,
                  fontWeight: FontWeight.w600,
                  color: ink.withValues(alpha: 0.8),
                  height: 1,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

enum BevelWordmarkSize { sm, md, lg }

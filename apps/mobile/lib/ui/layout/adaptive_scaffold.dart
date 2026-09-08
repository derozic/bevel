import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import 'bevel_breakpoints.dart';

/// Wraps app content with [BevelLayoutScope] and optional split shell.
class AdaptiveScaffold extends StatelessWidget {
  const AdaptiveScaffold({
    super.key,
    required this.body,
    this.rail,
    this.appBar,
    this.floatingActionButton,
    this.backgroundColor,
  });

  final Widget body;
  final Widget? rail;
  final PreferredSizeWidget? appBar;
  final Widget? floatingActionButton;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final info = BevelLayoutInfo.of(context);
    final p = context.bevel;

    Widget content = body;
    if (info.prefersSplit && rail != null) {
      content = Row(
        children: [
          SizedBox(
            width: info.isFoldInner ? 280 : 300,
            child: Material(
              color: p.railWash,
              child: rail,
            ),
          ),
          VerticalDivider(width: 1, thickness: 1, color: p.border),
          Expanded(child: body),
        ],
      );
    }

    return BevelLayoutScope(
      info: info,
      child: Scaffold(
        backgroundColor: backgroundColor ?? p.cream,
        appBar: appBar,
        floatingActionButton: floatingActionButton,
        body: SafeArea(
          // Fold cover: keep all insets so nothing sits under system UI
          minimum: info.isFoldCover
              ? const EdgeInsets.symmetric(horizontal: 8, vertical: 4)
              : EdgeInsets.zero,
          child: content,
        ),
      ),
    );
  }
}

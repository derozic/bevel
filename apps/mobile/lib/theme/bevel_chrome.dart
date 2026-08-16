import 'package:flutter/material.dart';

import 'bevel_mark.dart';
import 'daypart_controller.dart';

/// App bar title: mark + wordmark (used on native shells).
class BevelBrandTitle extends StatelessWidget {
  const BevelBrandTitle({super.key, this.subtitle});

  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    return Row(
      children: [
        BevelMark(size: 26, palette: p),
        const SizedBox(width: 10),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const BevelWordmark(size: BevelWordmarkSize.md),
              if (subtitle != null && subtitle!.isNotEmpty)
                Text(
                  subtitle!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    color: p.muted,
                    fontWeight: FontWeight.w400,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class BevelSnack {
  static void show(BuildContext context, String message) {
    final p = context.bevel;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: TextStyle(color: p.ink, height: 1.35)),
        behavior: SnackBarBehavior.floating,
        backgroundColor: p.surfaceRaised,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: p.border),
        ),
      ),
    );
  }
}

/// Slim product bar: mark + live title. Title tap is the primary switcher.
class BevelShellBar extends StatelessWidget implements PreferredSizeWidget {
  const BevelShellBar({
    super.key,
    required this.title,
    this.subtitle,
    this.onTitleTap,
    this.actions = const [],
    this.progress,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onTitleTap;
  final List<Widget> actions;
  final double? progress;

  @override
  Size get preferredSize => Size.fromHeight(progress != null ? 58 : 56);

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    return AppBar(
      titleSpacing: 8,
      title: InkWell(
        onTap: onTitleTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
          child: Row(
            children: [
              BevelMark(size: 26, palette: p),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                        color: p.ink,
                      ),
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty)
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11, color: p.muted),
                      ),
                  ],
                ),
              ),
              if (onTitleTap != null)
                Icon(Icons.expand_more_rounded, size: 20, color: p.subtle),
            ],
          ),
        ),
      ),
      actions: actions,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(2),
        child: progress != null
            ? LinearProgressIndicator(
                value: progress! > 0 && progress! < 1 ? progress : null,
                minHeight: 2,
                color: p.accent,
                backgroundColor: Colors.transparent,
              )
            : const SizedBox(height: 2),
      ),
    );
  }
}

class BevelHairlineCard extends StatelessWidget {
  const BevelHairlineCard({
    super.key,
    required this.child,
    this.onTap,
    this.highlighted = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
  });

  final Widget child;
  final VoidCallback? onTap;
  final bool highlighted;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final p = context.bevel;
    final radius = BorderRadius.circular(16);
    return Material(
      color: highlighted ? p.accent.withValues(alpha: 0.08) : p.surface,
      borderRadius: radius,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(
              color: highlighted ? p.accent.withValues(alpha: 0.45) : p.border,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

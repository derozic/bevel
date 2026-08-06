import 'dart:ui' show DisplayFeature, DisplayFeatureType;

import 'package:flutter/material.dart';

/// Form-factor classes for BEVEL adaptive UI.
///
/// - [compact]: phones + Fold cover / outer screen
/// - [medium]: large phones (Pro Max class), small tablet portrait
/// - [expanded]: iPad Pro, Pixel Tablet, Fold inner (unfolded)
enum BevelLayoutClass { compact, medium, expanded }

/// How the physical display is being used (especially foldables).
enum BevelSurfaceMode {
  /// Single continuous surface (phone, tablet, macOS).
  flat,

  /// Fold cover / outer screen — maximize touch targets, minimal chrome.
  foldCover,

  /// Fold inner / dual-pane capable surface.
  foldInner,
}

@immutable
class BevelLayoutInfo {
  const BevelLayoutInfo({
    required this.layoutClass,
    required this.surfaceMode,
    required this.size,
    required this.shortestSide,
    required this.longestSide,
    required this.isLandscape,
    required this.hasHinge,
    required this.safePadding,
  });

  final BevelLayoutClass layoutClass;
  final BevelSurfaceMode surfaceMode;
  final Size size;
  final double shortestSide;
  final double longestSide;
  final bool isLandscape;
  final bool hasHinge;
  final EdgeInsets safePadding;

  bool get isCompact => layoutClass == BevelLayoutClass.compact;
  bool get isMedium => layoutClass == BevelLayoutClass.medium;
  bool get isExpanded => layoutClass == BevelLayoutClass.expanded;
  bool get isFoldCover => surfaceMode == BevelSurfaceMode.foldCover;
  bool get isFoldInner => surfaceMode == BevelSurfaceMode.foldInner;

  /// Dual-pane (native rail + workspace) when width and surface allow it.
  ///
  /// Tablets (iPad Pro, Pixel Tablet) get a rail in landscape always, and in
  /// portrait when short side is tablet-class (≥600) and width ≥ 720.
  bool get prefersSplit {
    if (surfaceMode == BevelSurfaceMode.foldCover) return false;
    if (surfaceMode == BevelSurfaceMode.foldInner && size.width >= 700) {
      return true;
    }
    if (isExpanded && isLandscape && size.width >= 840) return true;
    // Portrait iPad / large tablet — collapsible dual-pane at 720+
    if ((isExpanded || isMedium) && size.width >= 720 && shortestSide >= 600) {
      return true;
    }
    return false;
  }

  /// Large touch targets for cover screens and compact phones.
  double get minTouchTarget => isFoldCover || isCompact ? 48 : 44;

  double get contentMaxWidth {
    switch (layoutClass) {
      case BevelLayoutClass.compact:
        return isFoldCover ? 420 : 560;
      case BevelLayoutClass.medium:
        return 720;
      case BevelLayoutClass.expanded:
        return prefersSplit ? double.infinity : 1100;
    }
  }

  static BevelLayoutInfo of(BuildContext context) {
    final mq = MediaQuery.of(context);
    final size = mq.size;
    final shortest = size.shortestSide;
    final longest = size.longestSide;
    final features = mq.displayFeatures;
    final hasHinge = features.any(
      (f) =>
          f.type == DisplayFeatureType.hinge ||
          f.type == DisplayFeatureType.fold,
    );

    // Cover-like: very narrow outer display (Fold cover ~ ~3.4–4.5" class)
    final surface = _surfaceMode(
      size: size,
      hasHinge: hasHinge,
      features: features,
    );

    final layoutClass = _layoutClass(
      shortest: shortest,
      width: size.width,
      surface: surface,
    );

    return BevelLayoutInfo(
      layoutClass: layoutClass,
      surfaceMode: surface,
      size: size,
      shortestSide: shortest,
      longestSide: longest,
      isLandscape: size.width > size.height,
      hasHinge: hasHinge,
      safePadding: mq.padding,
    );
  }

  static BevelSurfaceMode _surfaceMode({
    required Size size,
    required bool hasHinge,
    required List<DisplayFeature> features,
  }) {
    if (!hasHinge) return BevelSurfaceMode.flat;

    // Outer/cover: narrow width relative to height, or hinge-bounded small pane
    if (size.width < 420 || size.shortestSide < 400) {
      return BevelSurfaceMode.foldCover;
    }
    // Unfolded inner typically width >> 600
    if (size.width >= 600) return BevelSurfaceMode.foldInner;
    return BevelSurfaceMode.foldCover;
  }

  static BevelLayoutClass _layoutClass({
    required double shortest,
    required double width,
    required BevelSurfaceMode surface,
  }) {
    if (surface == BevelSurfaceMode.foldCover) {
      return BevelLayoutClass.compact;
    }
    // Material-ish: compact < 600 shortest, medium < 840, else expanded
    // Pro Max class phones still compact/medium by width
    if (shortest < 600) {
      // Large phones in landscape can feel medium
      if (width >= 700) return BevelLayoutClass.medium;
      return BevelLayoutClass.compact;
    }
    if (shortest < 840) return BevelLayoutClass.medium;
    return BevelLayoutClass.expanded;
  }
}

/// Inherited layout info for subtree widgets.
class BevelLayoutScope extends InheritedWidget {
  const BevelLayoutScope({
    super.key,
    required this.info,
    required super.child,
  });

  final BevelLayoutInfo info;

  static BevelLayoutInfo of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<BevelLayoutScope>();
    return scope?.info ?? BevelLayoutInfo.of(context);
  }

  @override
  bool updateShouldNotify(BevelLayoutScope oldWidget) =>
      oldWidget.info.layoutClass != info.layoutClass ||
      oldWidget.info.surfaceMode != info.surfaceMode ||
      oldWidget.info.size != info.size;
}

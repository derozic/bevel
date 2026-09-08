import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'bevel_palette.dart';

ThemeData buildBevelTheme(BevelPalette p) {
  final scheme = ColorScheme(
    brightness: p.brightness,
    primary: p.accent,
    onPrimary: p.cream,
    secondary: p.accentMuted,
    onSecondary: p.cream,
    surface: p.surface,
    onSurface: p.ink,
    error: const Color(0xFFDC4C3E),
    onError: Colors.white,
    outline: p.border,
    outlineVariant: p.border,
  );

  final text = TextTheme(
    headlineLarge: TextStyle(
      fontSize: 32,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.6,
      height: 1.15,
      color: p.ink,
    ),
    headlineSmall: TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.4,
      height: 1.2,
      color: p.ink,
    ),
    titleLarge: TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.2,
      color: p.ink,
    ),
    titleMedium: TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w600,
      color: p.ink,
    ),
    bodyLarge: TextStyle(
      fontSize: 16,
      height: 1.45,
      color: p.ink,
    ),
    bodyMedium: TextStyle(
      fontSize: 14,
      height: 1.45,
      color: p.muted,
    ),
    bodySmall: TextStyle(
      fontSize: 12,
      height: 1.4,
      color: p.subtle,
    ),
    labelLarge: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.1,
      color: p.ink,
    ),
  );

  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));

  return ThemeData(
    useMaterial3: true,
    brightness: p.brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.cream,
    canvasColor: p.cream,
    dividerColor: p.border,
    textTheme: text,
    primaryTextTheme: text,
    appBarTheme: AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: p.cream.withValues(alpha: 0.92),
      foregroundColor: p.ink,
      surfaceTintColor: Colors.transparent,
      systemOverlayStyle:
          defaultTargetPlatform == TargetPlatform.iOS ||
              defaultTargetPlatform == TargetPlatform.android
          ? (p.isNight
              ? SystemUiOverlayStyle.light
              : SystemUiOverlayStyle.dark)
          : null,
      titleTextStyle: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        color: p.ink,
      ),
      iconTheme: IconThemeData(color: p.ink, size: 22),
    ),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: shape.copyWith(
        side: BorderSide(color: p.border),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: p.surfaceRaised,
      surfaceTintColor: Colors.transparent,
      shape: shape.copyWith(side: BorderSide(color: p.border)),
      titleTextStyle: text.titleLarge,
      contentTextStyle: text.bodyMedium?.copyWith(color: p.muted, height: 1.45),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.cta,
        foregroundColor: p.ctaFg,
        disabledBackgroundColor: p.ink.withValues(alpha: 0.18),
        disabledForegroundColor: p.cream.withValues(alpha: 0.7),
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.ink,
        side: BorderSide(color: p.border),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: p.accent,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: p.cta,
      foregroundColor: p.ctaFg,
      elevation: 0,
      focusElevation: 0,
      hoverElevation: 0,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: p.surfaceRaised,
      surfaceTintColor: Colors.transparent,
      textStyle: TextStyle(color: p.ink, fontSize: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: p.border),
      ),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: p.muted,
      textColor: p.ink,
      subtitleTextStyle: TextStyle(color: p.muted, fontSize: 13, height: 1.35),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) {
        if (s.contains(WidgetState.selected)) return p.cream;
        return p.muted;
      }),
      trackColor: WidgetStateProperty.resolveWith((s) {
        if (s.contains(WidgetState.selected)) return p.accent;
        return p.border;
      }),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: p.accent),
    iconTheme: IconThemeData(color: p.ink),
    dividerTheme: DividerThemeData(color: p.border, space: 1, thickness: 1),
  );
}

import 'package:flutter/material.dart';

import 'daypart.dart';

/// Trained atmosphere tokens — hex approximations of web oklch daypart.css.
@immutable
class BevelPalette {
  const BevelPalette({
    required this.id,
    required this.brightness,
    required this.cream,
    required this.surface,
    required this.surfaceRaised,
    required this.ink,
    required this.muted,
    required this.subtle,
    required this.border,
    required this.accent,
    required this.accentMuted,
    required this.meshA,
    required this.meshB,
    required this.railWash,
    required this.markFace,
    required this.markLeft,
    required this.markRight,
    required this.markCrease,
    required this.markGlint,
  });

  final DaypartId id;
  final Brightness brightness;
  final Color cream;
  final Color surface;
  final Color surfaceRaised;
  final Color ink;
  final Color muted;
  final Color subtle;
  final Color border;
  final Color accent;
  final Color accentMuted;
  final Color meshA;
  final Color meshB;
  final Color railWash;
  final Color markFace;
  final Color markLeft;
  final Color markRight;
  final Color markCrease;
  final Color markGlint;

  /// Solid CTA is ink fill + cream label (always high contrast).
  Color get cta => ink;
  Color get ctaFg => cream;

  bool get isNight => brightness == Brightness.dark;

  static const morning = BevelPalette(
    id: DaypartId.morning,
    brightness: Brightness.light,
    cream: Color(0xFFFBF4EA),
    surface: Color(0xFFFDF8F2),
    surfaceRaised: Color(0xFFFFFCF8),
    ink: Color(0xFF3C3028),
    muted: Color(0xFF7C6E64),
    subtle: Color(0xFF908278),
    border: Color(0x1A3C3028),
    accent: Color(0xFFD35A28),
    accentMuted: Color(0xFFE08A5A),
    meshA: Color(0x73F0C8A8),
    meshB: Color(0x59F0DCA0),
    railWash: Color(0xFFF8EFE4),
    markFace: Color(0xFF382E26),
    markLeft: Color(0x6B52463C),
    markRight: Color(0x94322820),
    markCrease: Color(0xFFD35A28),
    markGlint: Color(0x29FFFFFF),
  );

  static const midday = BevelPalette(
    id: DaypartId.midday,
    brightness: Brightness.light,
    cream: Color(0xFFF3F7F9),
    surface: Color(0xFFFFFFFF),
    surfaceRaised: Color(0xFFF7FBFC),
    ink: Color(0xFF243040),
    muted: Color(0xFF6A7688),
    subtle: Color(0xFF8490A0),
    border: Color(0x17243040),
    accent: Color(0xFF1A9BB5),
    accentMuted: Color(0xFF5BB8C8),
    meshA: Color(0x66A8DCEC),
    meshB: Color(0x4DB8E8E0),
    railWash: Color(0xFFEEF5F7),
    markFace: Color(0xFF111827),
    markLeft: Color(0x59111827),
    markRight: Color(0x8C111827),
    markCrease: Color(0xFF1A9BB5),
    markGlint: Color(0x1FFFFFFF),
  );

  static const afternoon = BevelPalette(
    id: DaypartId.afternoon,
    brightness: Brightness.light,
    cream: Color(0xFFF7EEDC),
    surface: Color(0xFFFBF6EA),
    surfaceRaised: Color(0xFFFDF8EE),
    ink: Color(0xFF3A2C1E),
    muted: Color(0xFF7A6854),
    subtle: Color(0xFF8E7C68),
    border: Color(0x1C3A2C1E),
    accent: Color(0xFFC86A1C),
    accentMuted: Color(0xFFD4924A),
    meshA: Color(0x6BE8C090),
    meshB: Color(0x47E8C8A0),
    railWash: Color(0xFFF4E8D0),
    markFace: Color(0xFF362818),
    markLeft: Color(0x66503C28),
    markRight: Color(0x992E2014),
    markCrease: Color(0xFFC86A1C),
    markGlint: Color(0x26FFF8E8),
  );

  static const night = BevelPalette(
    id: DaypartId.night,
    brightness: Brightness.dark,
    cream: Color(0xFF101825),
    surface: Color(0xFF172033),
    surfaceRaised: Color(0xFF1E2B44),
    ink: Color(0xFFE8EEF6),
    muted: Color(0xFF9AABC0),
    subtle: Color(0xFF7D8DA0),
    border: Color(0x1FE8EEF6),
    accent: Color(0xFF7AA6E8),
    accentMuted: Color(0xFF5A84C4),
    meshA: Color(0x6B2A3D68),
    meshB: Color(0x521E3258),
    railWash: Color(0xFF152038),
    markFace: Color(0xFFE4EAF4),
    markLeft: Color(0x73A8B8D0),
    markRight: Color(0x9EC4D0E0),
    markCrease: Color(0xFF7AA6E8),
    markGlint: Color(0x1FF4F8FC),
  );

  static BevelPalette forId(DaypartId id) {
    switch (id) {
      case DaypartId.morning:
        return morning;
      case DaypartId.midday:
        return midday;
      case DaypartId.afternoon:
        return afternoon;
      case DaypartId.night:
        return night;
    }
  }
}

import 'package:bevel_app/theme/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('clock maps to the four trained atmospheres', () {
    expect(daypartFromHour(6), DaypartId.morning);
    expect(daypartFromHour(12), DaypartId.midday);
    expect(daypartFromHour(16), DaypartId.afternoon);
    expect(daypartFromHour(22), DaypartId.night);
    expect(daypartFromHour(3), DaypartId.night);
  });

  test('auto follows the clock; explicit preference wins', () {
    expect(
      resolveDaypart(DaypartPreference.auto, DateTime(2026, 8, 15, 21)),
      DaypartId.night,
    );
    expect(
      resolveDaypart(DaypartPreference.morning, DateTime(2026, 8, 15, 21)),
      DaypartId.morning,
    );
  });

  test('night is navy, not charcoal orange', () {
    final night = BevelPalette.night;
    expect(night.brightness, Brightness.dark);
    expect(night.cream.b, greaterThan(night.cream.r));
    expect(night.accent.b, greaterThan(night.accent.r));
    expect(night.cta, night.ink);
    expect(night.ctaFg, night.cream);
  });

  test('morning and midday stay light paper', () {
    expect(BevelPalette.morning.brightness, Brightness.light);
    expect(BevelPalette.midday.brightness, Brightness.light);
    expect(BevelPalette.afternoon.brightness, Brightness.light);
  });
}

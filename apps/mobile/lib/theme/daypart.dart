/// Clock-driven atmospheres — same four parts as the web product.
enum DaypartId { morning, midday, afternoon, night }

enum DaypartPreference { auto, morning, midday, afternoon, night }

DaypartId daypartFromHour(int hour) {
  if (hour >= 5 && hour < 11) return DaypartId.morning;
  if (hour >= 11 && hour < 15) return DaypartId.midday;
  if (hour >= 15 && hour < 20) return DaypartId.afternoon;
  return DaypartId.night;
}

DaypartId resolveDaypart(
  DaypartPreference preference, [
  DateTime? now,
]) {
  if (preference != DaypartPreference.auto) {
    return DaypartId.values.byName(preference.name);
  }
  return daypartFromHour((now ?? DateTime.now()).hour);
}

class DaypartMeta {
  const DaypartMeta({
    required this.label,
    required this.shortLabel,
    required this.hours,
    required this.greeting,
  });

  final String label;
  final String shortLabel;
  final String hours;
  final String greeting;
}

const daypartMeta = <DaypartId, DaypartMeta>{
  DaypartId.morning: DaypartMeta(
    label: 'Morning',
    shortLabel: 'AM',
    hours: '5:00 – 11:00',
    greeting: 'Clear light, soft contrast — ease into the day.',
  ),
  DaypartId.midday: DaypartMeta(
    label: 'Midday',
    shortLabel: 'Noon',
    hours: '11:00 – 15:00',
    greeting: 'Peak clarity — cool light, crisp structure.',
  ),
  DaypartId.afternoon: DaypartMeta(
    label: 'Afternoon',
    shortLabel: 'PM',
    hours: '15:00 – 20:00',
    greeting: 'Golden hour warmth as the day slopes down.',
  ),
  DaypartId.night: DaypartMeta(
    label: 'Night',
    shortLabel: 'Eve',
    hours: '20:00 – 5:00',
    greeting: 'Low-luminance navy — easy on the eyes.',
  ),
};

extension DaypartPreferenceX on DaypartPreference {
  String get storageValue => name;

  static DaypartPreference parse(String? raw) {
    switch (raw) {
      case 'morning':
        return DaypartPreference.morning;
      case 'midday':
        return DaypartPreference.midday;
      case 'afternoon':
        return DaypartPreference.afternoon;
      case 'night':
        return DaypartPreference.night;
      default:
        return DaypartPreference.auto;
    }
  }
}

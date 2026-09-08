import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'bevel_palette.dart';
import 'daypart.dart';

const _prefKey = 'bevel.daypart.preference';

/// Resolves and persists daypart. Ticks every minute when preference is auto.
class DaypartController extends ChangeNotifier {
  DaypartController({DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;

  final DateTime Function() _clock;

  DaypartPreference preference = DaypartPreference.auto;
  DaypartId resolved = resolveDaypart(DaypartPreference.auto);
  Timer? _timer;

  BevelPalette get palette => BevelPalette.forId(resolved);
  DaypartMeta get meta => daypartMeta[resolved]!;

  Future<void> start() async {
    _tick();
    await _load();
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) => _tick());
  }

  Future<void> setPreference(DaypartPreference next) async {
    preference = next;
    _tick();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKey, next.storageValue);
    } catch (_) {
      // Tests / missing plugin — in-memory preference still applies.
    }
  }

  void _tick() {
    final next = resolveDaypart(preference, _clock());
    if (next == resolved) {
      notifyListeners();
      return;
    }
    resolved = next;
    notifyListeners();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      preference = DaypartPreferenceX.parse(prefs.getString(_prefKey));
      _tick();
    } catch (_) {
      _tick();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

class DaypartScope extends InheritedNotifier<DaypartController> {
  const DaypartScope({
    super.key,
    required DaypartController controller,
    required super.child,
  }) : super(notifier: controller);

  static DaypartController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<DaypartScope>();
    assert(scope != null, 'DaypartScope not found');
    return scope!.notifier!;
  }

  static DaypartController? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<DaypartScope>()?.notifier;
  }
}

extension BevelPaletteX on BuildContext {
  BevelPalette get bevel {
    final ctrl = DaypartScope.maybeOf(this);
    if (ctrl != null) return ctrl.palette;
    return BevelPalette.forId(resolveDaypart(DaypartPreference.auto));
  }

  DaypartController? get daypart => DaypartScope.maybeOf(this);
}

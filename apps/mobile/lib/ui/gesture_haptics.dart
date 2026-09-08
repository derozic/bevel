import 'package:flutter/services.dart';

/// Maps a chat gesture kind to a native haptic so reactions feel physical.
enum BevelHaptic { light, medium, heavy, selection }

BevelHaptic hapticForGesture(String kind) {
  switch (kind.trim().toLowerCase()) {
    case 'heart':
      return BevelHaptic.heavy;
    case 'down':
    case 'vote_no':
      return BevelHaptic.medium;
    case 'dock':
    case 'star':
      return BevelHaptic.selection;
    default:
      return BevelHaptic.light;
  }
}

Future<void> playGestureHaptic(String kind) {
  switch (hapticForGesture(kind)) {
    case BevelHaptic.heavy:
      return HapticFeedback.heavyImpact();
    case BevelHaptic.medium:
      return HapticFeedback.mediumImpact();
    case BevelHaptic.selection:
      return HapticFeedback.selectionClick();
    case BevelHaptic.light:
      return HapticFeedback.lightImpact();
  }
}

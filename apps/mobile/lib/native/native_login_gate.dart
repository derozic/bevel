/// One system-browser Google hop at a time.
///
/// The WebView used to reopen accounts.google.com / Auth.js URLs, which
/// spawned 4–5 parallel login tabs. This lock keeps that to a single trip.
class NativeLoginGate {
  NativeLoginGate._();

  static DateTime? _openedAt;
  static DateTime? _completedAt;

  static const _openTtl = Duration(seconds: 90);
  static const _completeTtl = Duration(seconds: 45);

  static bool get inFlight {
    final opened = _openedAt;
    if (opened == null) return false;
    return DateTime.now().difference(opened) < _openTtl;
  }

  static bool get recentlyCompleted {
    final done = _completedAt;
    if (done == null) return false;
    return DateTime.now().difference(done) < _completeTtl;
  }

  /// Returns false when another hop is already open or just finished.
  static bool tryBegin() {
    if (inFlight || recentlyCompleted) return false;
    _openedAt = DateTime.now();
    return true;
  }

  static void markComplete() {
    _completedAt = DateTime.now();
  }

  static void reset() {
    _openedAt = null;
    _completedAt = null;
  }
}

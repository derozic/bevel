import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';

import '../config.dart';

/// macOS / desktop window defaults for Apple Silicon builds.
Future<void> bootstrapDesktopWindow() async {
  if (kIsWeb) return;
  if (!(Platform.isMacOS || Platform.isWindows || Platform.isLinux)) return;

  await windowManager.ensureInitialized();

  const options = WindowOptions(
    size: Size(1280, 840),
    minimumSize: Size(880, 600),
    center: true,
    backgroundColor: Color(0xFFF4F0E8),
    skipTaskbar: false,
    titleBarStyle: TitleBarStyle.normal,
    title: BevelConfig.appName,
  );

  // Do not hide-then-show. waitUntilReadyToShow can leave a headless process
  // when macOS refuses to foreground (OSStatus 13).
  try {
    await windowManager.setMinimumSize(options.minimumSize ?? const Size(880, 600));
    await windowManager.setSize(options.size ?? const Size(1280, 840));
    await windowManager.setTitle(BevelConfig.appName);
    await windowManager.center();
    await windowManager.show();
    await windowManager.focus();
  } catch (e) {
    debugPrint('Desktop window show failed: $e');
  }
}

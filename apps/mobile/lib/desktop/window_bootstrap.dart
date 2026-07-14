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
    backgroundColor: Color(0xFF0A0E12),
    skipTaskbar: false,
    titleBarStyle: TitleBarStyle.normal,
    title: BevelConfig.appName,
  );

  await windowManager.waitUntilReadyToShow(options, () async {
    await windowManager.setTitle(BevelConfig.appName);
    await windowManager.show();
    await windowManager.focus();
  });
}

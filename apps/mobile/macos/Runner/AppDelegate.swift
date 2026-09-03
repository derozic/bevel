import Cocoa
import FlutterMacOS

@main
class AppDelegate: FlutterAppDelegate {
  override func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    // Single-window chat client: closing the window should quit, not leave a
    // headless dock icon with zero windows.
    return true
  }

  override func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
    return true
  }

  override func applicationShouldHandleReopen(
    _ sender: NSApplication,
    hasVisibleWindows flag: Bool
  ) -> Bool {
    if !flag {
      let windows = sender.windows
      if windows.isEmpty {
        mainFlutterWindow?.makeKeyAndOrderFront(self)
      } else {
        for window in windows {
          window.makeKeyAndOrderFront(self)
        }
      }
      NSApp.activate(ignoringOtherApps: true)
    }
    return true
  }

  // Keep FlutterAppDelegate's plugin forwarding (app_links) and bring the
  // window forward after bevel://auth/complete from the system browser.
  override func application(_ application: NSApplication, open urls: [URL]) {
    super.application(application, open: urls)
    NSApp.activate(ignoringOtherApps: true)
    for window in application.windows {
      window.makeKeyAndOrderFront(self)
    }
  }
}

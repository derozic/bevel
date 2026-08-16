import Cocoa
import FlutterMacOS

@main
class AppDelegate: FlutterAppDelegate {
  override func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    // Keep app alive in dock when window closes — standard Mac behavior
    return false
  }

  override func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
    return true
  }

  override func applicationShouldHandleReopen(
    _ sender: NSApplication,
    hasVisibleWindows flag: Bool
  ) -> Bool {
    if !flag {
      for window in sender.windows {
        window.makeKeyAndOrderFront(self)
      }
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

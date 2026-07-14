import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    // Desktop shell defaults for Apple Silicon
    self.title = "BEVEL"
    self.minSize = NSSize(width: 880, height: 600)
    self.setContentSize(NSSize(width: 1280, height: 840))
    self.isReleasedWhenClosed = false
    self.backgroundColor = NSColor(calibratedRed: 0.039, green: 0.055, blue: 0.071, alpha: 1)

    RegisterGeneratedPlugins(registry: flutterViewController)

    super.awakeFromNib()
  }
}

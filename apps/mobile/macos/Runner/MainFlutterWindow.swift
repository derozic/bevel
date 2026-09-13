import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  /// Retained for the window lifetime so media huddle discovery stays registered.
  private var mediaDeviceChannel: MediaDeviceChannel?
  /// Local iMessage host (chat.db + AppleScript). Replaces BlueBubbles.
  private var iMessageChannel: IMessageChannel?
  /// Apple Intelligence / Neural Engine — on-device only.
  private var intelligenceChannel: OnDeviceIntelligenceChannel?

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
    self.backgroundColor = NSColor(calibratedRed: 0.047, green: 0.047, blue: 0.055, alpha: 1)
    self.titleVisibility = .hidden
    self.titlebarAppearsTransparent = true
    self.styleMask.insert(.fullSizeContentView)
    if #available(macOS 11.0, *) {
      self.titlebarSeparatorStyle = .none
    }

    RegisterGeneratedPlugins(registry: flutterViewController)

    // Host mic/speaker/camera discovery for audio huddles (CoreAudio + AVFoundation).
    mediaDeviceChannel = MediaDeviceChannel(
      messenger: flutterViewController.engine.binaryMessenger
    )
    iMessageChannel = IMessageChannel(
      messenger: flutterViewController.engine.binaryMessenger
    )
    intelligenceChannel = OnDeviceIntelligenceChannel(
      messenger: flutterViewController.engine.binaryMessenger
    )

    super.awakeFromNib()

    // window_manager's waitUntilReadyToShow can hide the nib window and then
    // fail to foreground (OSStatus 13). Always order front ourselves.
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.makeKeyAndOrderFront(nil)
      NSApp.activate(ignoringOtherApps: true)
    }
  }
}

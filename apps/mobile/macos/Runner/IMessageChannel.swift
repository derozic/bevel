import Cocoa
import FlutterMacOS

/// Native iMessage host. Channel: com.derozic.bevel/imessage
///
/// Replaces the standalone BlueBubbles server for this Mac. Reads chat.db,
/// sends via AppleScript, stores account mode locally. No Firebase.
final class IMessageChannel: NSObject, FlutterStreamHandler {
  static let name = "com.derozic.bevel/imessage"
  static let eventsName = "com.derozic.bevel/imessage_events"
  static let accountModeKey = "bevel.imessage.accountMode"
  static let enabledKey = "bevel.imessage.enabled"
  static let passwordKey = "bevel.imessage.apiPassword"

  private let channel: FlutterMethodChannel
  private let events: FlutterEventChannel
  private let store = IMessageStore()
  private let sender = IMessageSender()
  private var api: IMessageApiServer?
  private var sink: FlutterEventSink?

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: IMessageChannel.name, binaryMessenger: messenger)
    events = FlutterEventChannel(name: IMessageChannel.eventsName, binaryMessenger: messenger)
    super.init()
    channel.setMethodCallHandler(handle)
    events.setStreamHandler(self)
    if UserDefaults.standard.bool(forKey: IMessageChannel.enabledKey) {
      _ = startApi()
    }
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "status":
      result(status())
    case "requestPermissions":
      result(requestPermissions())
    case "openPrivacyPane":
      let args = call.arguments as? [String: Any]
      let pane = (args?["pane"] as? String) ?? "fda"
      openPrivacyPane(pane)
      result(true)
    case "setAccountMode":
      let args = call.arguments as? [String: Any]
      let mode = (args?["mode"] as? String) ?? "dedicated"
      setAccountMode(mode)
      result(status())
    case "setEnabled":
      let args = call.arguments as? [String: Any]
      let on = (args?["enabled"] as? Bool) ?? false
      UserDefaults.standard.set(on, forKey: Self.enabledKey)
      if on {
        _ = startApi()
      } else {
        api?.stop()
        api = nil
      }
      result(status())
    case "listRecentChats":
      let args = call.arguments as? [String: Any]
      let limit = (args?["limit"] as? Int) ?? 40
      do {
        result(["ok": true, "chats": try store.listRecentChats(limit: limit)])
      } catch {
        result([
          "ok": false,
          "chats": [],
          "error": error.localizedDescription,
        ])
      }
    case "send":
      let args = call.arguments as? [String: Any]
      let address = (args?["address"] as? String) ?? ""
      let body = (args?["body"] as? String) ?? ""
      result(sender.send(address: address, body: body))
    case "startWatching":
      store.startWatching { [weak self] payload in
        DispatchQueue.main.async {
          self?.sink?(["type": "message", "payload": payload])
        }
      }
      result(true)
    case "stopWatching":
      store.stopWatching()
      result(true)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func status() -> [String: Any] {
    let access = store.probeAccess()
    let automation = sender.automationStatus()
    let mode = currentAccountMode()
    let readable = access["readable"] as? Bool ?? false
    let autoGranted = automation["granted"] as? Bool ?? false
    let enabled = UserDefaults.standard.bool(forKey: Self.enabledKey)
    return [
      "platform": "macos",
      "accountMode": mode,
      "enabled": enabled,
      "apiRunning": api?.running ?? false,
      "apiPort": Int(api?.port ?? 0),
      "apiUrl": (api?.running == true) ? "http://127.0.0.1:\(api!.port)" : "",
      "apiPasswordSet": !apiPassword().isEmpty,
      "databaseExists": access["exists"] as? Bool ?? false,
      "fullDiskAccess": readable,
      "automationGranted": autoGranted,
      "automationStatus": automation["status"] as? String ?? "unknown",
      "messageCount": access["messageCount"] as? Int64 ?? 0,
      "chatDbPath": access["path"] as? String ?? store.chatDBPath,
      "error": access["error"] as? String ?? "",
      "ready": enabled && readable && autoGranted,
    ]
  }

  @discardableResult
  private func startApi() -> Bool {
    if api?.running == true { return true }
    let server = IMessageApiServer(sender: sender, store: store, password: apiPassword())
    do {
      try server.start()
      api = server
      return true
    } catch {
      return false
    }
  }

  private func apiPassword() -> String {
    if let existing = UserDefaults.standard.string(forKey: Self.passwordKey), !existing.isEmpty {
      return existing
    }
    let generated = "bevel-\(UUID().uuidString.prefix(12))"
    UserDefaults.standard.set(generated, forKey: Self.passwordKey)
    return generated
  }

  private func requestPermissions() -> [String: Any] {
    openPrivacyPane("fda")
    let auto = sender.requestAutomation()
    sink?(["type": "permission", "payload": auto])
    return status()
  }

  private func currentAccountMode() -> String {
    let raw = UserDefaults.standard.string(forKey: Self.accountModeKey) ?? "dedicated"
    return raw == "personal" ? "personal" : "dedicated"
  }

  private func setAccountMode(_ raw: String) {
    let mode = raw == "personal" ? "personal" : "dedicated"
    UserDefaults.standard.set(mode, forKey: Self.accountModeKey)
  }

  private func openPrivacyPane(_ pane: String) {
    let urls: [String]
    if pane == "automation" {
      urls = [
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Automation",
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
      ]
    } else {
      urls = [
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
        "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
      ]
    }
    for value in urls {
      if let url = URL(string: value), NSWorkspace.shared.open(url) {
        return
      }
    }
  }

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    sink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    sink = nil
    return nil
  }
}

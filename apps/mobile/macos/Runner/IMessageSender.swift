import ApplicationServices
import Foundation

/// Send iMessage via the public Messages.app AppleScript dictionary.
/// No private API, no SIP, no dylib inject.
final class IMessageSender {
  static let messagesBundleId = "com.apple.MobileSMS"

  /// Normalize a phone or Apple ID the same way the Dart bridge does.
  static func normalizeAddress(_ raw: String) -> String {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.contains("@") { return trimmed }
    let digits = trimmed.filter(\.isNumber)
    if trimmed.hasPrefix("+") { return "+\(digits)" }
    if digits.count == 10 { return "+1\(digits)" }
    if digits.count == 11 && digits.hasPrefix("1") { return "+\(digits)" }
    if trimmed.hasPrefix("+") { return trimmed }
    return digits.isEmpty ? trimmed : "+\(digits)"
  }

  func automationStatus() -> [String: Any] {
    let target = NSAppleEventDescriptor(bundleIdentifier: Self.messagesBundleId)
    let err = AEDeterminePermissionToAutomateTarget(
      target.aeDesc,
      typeWildCard,
      typeWildCard,
      false
    )
    // 0 allowed, -1744 would require consent, -1743 denied.
    let granted: Bool
    let label: String
    if err == 0 {
      granted = true
      label = "granted"
    } else if err == OSStatus(errAEEventWouldRequireUserConsent) {
      granted = false
      label = "notDetermined"
    } else if err == OSStatus(errAEEventNotPermitted) {
      granted = false
      label = "denied"
    } else {
      granted = false
      label = "unknown"
    }
    return [
      "granted": granted,
      "status": label,
      "code": Int(err),
    ]
  }

  /// Prompt Automation TCC if needed, then report.
  func requestAutomation() -> [String: Any] {
    let target = NSAppleEventDescriptor(bundleIdentifier: Self.messagesBundleId)
    _ = AEDeterminePermissionToAutomateTarget(
      target.aeDesc,
      typeWildCard,
      typeWildCard,
      true
    )
    return automationStatus()
  }

  func send(address raw: String, body: String) -> [String: Any] {
    let address = Self.normalizeAddress(raw)
    let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
    if address.isEmpty {
      return ["ok": false, "error": "Address required"]
    }
    if text.isEmpty {
      return ["ok": false, "error": "Message body required"]
    }
    if text.count > 1500 {
      return ["ok": false, "error": "body too long (max 1500)"]
    }

    let scripts = [
      sendScript(address: address, body: text, style: .participant),
      sendScript(address: address, body: text, style: .buddy),
    ]
    var lastError = "Messages.app did not accept the send"
    for source in scripts {
      var error: NSDictionary?
      if let script = NSAppleScript(source: source) {
        let output = script.executeAndReturnError(&error)
        if error == nil {
          return [
            "ok": true,
            "address": address,
            "method": "apple-script",
            "result": output.stringValue ?? "",
          ]
        }
        lastError = (error?["NSAppleScriptErrorMessage"] as? String) ?? lastError
      }
    }
    return ["ok": false, "error": lastError, "address": address]
  }

  private enum ScriptStyle {
    case participant
    case buddy
  }

  private func sendScript(address: String, body: String, style: ScriptStyle) -> String {
    let a = escape(address)
    let b = escape(body)
    switch style {
    case .participant:
      return """
        tell application "Messages"
          set targetService to 1st account whose service type = iMessage
          set targetBuddy to participant "\(a)" of targetService
          send "\(b)" to targetBuddy
        end tell
        """
    case .buddy:
      return """
        tell application "Messages"
          set svc to first service whose service type is iMessage
          send "\(b)" to buddy "\(a)" of svc
        end tell
        """
    }
  }

  private func escape(_ value: String) -> String {
    value
      .replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "\"", with: "\\\"")
  }
}

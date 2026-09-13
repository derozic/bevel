#if os(macOS)
import FlutterMacOS
import AppKit
#else
import Flutter
import UIKit
#endif
import Foundation
import NaturalLanguage
import FoundationModels

/// On-device intelligence: Apple Foundation Models on Neural Engine when
/// available, NaturalLanguage fallback otherwise. Nothing leaves the device.
final class OnDeviceIntelligenceChannel {
  static let name = "bevel/on_device_intelligence"

  private let channel: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: Self.name, binaryMessenger: messenger)
    channel.setMethodCallHandler(handle)
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "capabilities":
      result(capabilities())
    case "summarize":
      guard let args = call.arguments as? [String: Any],
            let text = args["text"] as? String else {
        result(FlutterError(code: "bad_args", message: "text required", details: nil))
        return
      }
      let truncated = String(text.prefix(12_000))
      Task {
        do {
          let out = try await self.generate(
            instruction: "Summarize this workspace thread for a busy operator. Four tight bullets. No preamble.",
            text: truncated
          )
          result(out)
        } catch {
          result(FlutterError(code: "infer", message: error.localizedDescription, details: nil))
        }
      }
    case "rewrite":
      guard let args = call.arguments as? [String: Any],
            let text = args["text"] as? String else {
        result(FlutterError(code: "bad_args", message: "text required", details: nil))
        return
      }
      let tone = (args["tone"] as? String) ?? "clear"
      Task {
        do {
          let out = try await self.generate(
            instruction: "Rewrite this message so it is \(tone), concise, and ready to post in a team channel. Return only the rewritten message.",
            text: String(text.prefix(4_000))
          )
          result(out)
        } catch {
          result(FlutterError(code: "infer", message: error.localizedDescription, details: nil))
        }
      }
    case "classify":
      guard let args = call.arguments as? [String: Any],
            let text = args["text"] as? String else {
        result(FlutterError(code: "bad_args", message: "text required", details: nil))
        return
      }
      result(classify(text))
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func capabilities() -> [String: Any] {
    var foundation = false
    var reason = "natural_language"
    if #available(iOS 26.0, macOS 26.0, *) {
      foundation = SystemLanguageModel.default.isAvailable
      reason = foundation ? "foundation_models" : "foundation_unavailable"
    }
    return [
      "foundationModels": foundation,
      "neuralEngine": true,
      "naturalLanguage": true,
      "reason": reason,
      "onDevice": true,
    ]
  }

  private func generate(instruction: String, text: String) async throws -> String {
    if #available(iOS 26.0, macOS 26.0, *) {
      let model = SystemLanguageModel.default
      if model.isAvailable {
        let session = LanguageModelSession(model: model)
        let prompt = "\(instruction)\n\n---\n\(text)\n---"
        let response = try await session.respond(to: prompt)
        return response.content.trimmingCharacters(in: .whitespacesAndNewlines)
      }
    }
    return fallbackSummary(text)
  }

  private func fallbackSummary(_ text: String) -> String {
    let sentences = text
      .replacingOccurrences(of: "\r", with: "\n")
      .components(separatedBy: CharacterSet(charactersIn: ".!?\n"))
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { $0.count > 40 }
    let take = Array(sentences.prefix(4))
    if take.isEmpty {
      return String(text.prefix(280))
    }
    return take.map { "• \($0)" }.joined(separator: "\n")
  }

  private func classify(_ text: String) -> [String: Any] {
    let tagger = NLTagger(tagSchemes: [.language, .sentimentScore])
    tagger.string = text
    let lang = tagger.dominantLanguage?.rawValue ?? "und"
    let sentiment = tagger.tag(
      at: text.startIndex,
      unit: .document,
      scheme: .sentimentScore
    ).0?.rawValue
    return [
      "language": lang,
      "sentiment": sentiment ?? "0",
      "chars": text.count,
    ]
  }
}

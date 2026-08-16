import Foundation
import Network

/// Loopback HTTP that speaks the BlueBubbles v1 subset Bevel already calls.
///
/// BEVEL is the host. BlueBubbles.app is not required.
/// Bind: 127.0.0.1 only. Started only when the operator enables the feature.
final class IMessageApiServer {
  static let defaultPort: UInt16 = 1234

  private let sender: IMessageSender
  private let store: IMessageStore
  private var listener: NWListener?
  var port: UInt16 = IMessageApiServer.defaultPort
  var password: String
  var running = false

  init(sender: IMessageSender, store: IMessageStore, password: String) {
    self.sender = sender
    self.store = store
    self.password = password
  }

  func start(preferredPort: UInt16 = IMessageApiServer.defaultPort) throws {
    stop()
    var lastError: Error?
    for candidate in [preferredPort, 12434, 1734] {
      do {
        try listen(on: candidate)
        port = candidate
        running = true
        return
      } catch {
        lastError = error
      }
    }
    throw lastError ?? NSError(
      domain: "bevel.imessage",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: "Could not bind loopback API"]
    )
  }

  func stop() {
    listener?.cancel()
    listener = nil
    running = false
  }

  private func listen(on port: UInt16) throws {
    let params = NWParameters.tcp
    params.allowLocalEndpointReuse = true
    params.requiredInterfaceType = .loopback
    let listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)
    listener.newConnectionHandler = { [weak self] conn in
      self?.accept(conn)
    }
    listener.start(queue: .global(qos: .userInitiated))
    self.listener = listener
  }

  private func accept(_ conn: NWConnection) {
    conn.start(queue: .global(qos: .userInitiated))
    conn.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, _, error in
      guard let self, let data, error == nil else {
        conn.cancel()
        return
      }
      let response = self.handle(data)
      conn.send(
        content: response,
        completion: .contentProcessed { _ in conn.cancel() }
      )
    }
  }

  private func handle(_ data: Data) -> Data {
    let raw = String(data: data, encoding: .utf8) ?? ""
    let lines = raw.split(separator: "\r\n", omittingEmptySubsequences: false)
    let requestLine = lines.first.map(String.init) ?? ""
    let parts = requestLine.split(separator: " ")
    let method = parts.count > 0 ? String(parts[0]) : "GET"
    let pathQuery = parts.count > 1 ? String(parts[1]) : "/"
    let pathParts = pathQuery.split(separator: "?", maxSplits: 1)
    let path = String(pathParts[0])
    let query = pathParts.count > 1 ? parseQuery(String(pathParts[1])) : [:]

    var headers: [String: String] = [:]
    var bodyStart = 1
    for (i, line) in lines.enumerated() where i > 0 {
      if line.isEmpty {
        bodyStart = i + 1
        break
      }
      if let colon = line.firstIndex(of: ":") {
        let key = line[..<colon].lowercased()
        let val = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        headers[key] = val
      }
    }
    let body = lines.dropFirst(bodyStart).joined(separator: "\r\n")

    if !authorized(query: query, headers: headers) {
      return json(401, ["status": 401, "message": "Unauthorized", "error": "Missing or invalid server password"])
    }

    if path == "/api/v1/ping" || path == "/api/v1/server/info" {
      return json(200, [
        "status": 200,
        "message": "Success",
        "data": [
          "private_api": false,
          "helper_connected": false,
          "proxy_service": "bevel",
          "detected_imessage": true,
          "server_version": "bevel-native",
        ],
      ])
    }

    if (path == "/api/v1/message/text" || path == "/api/v1/message") && method == "POST" {
      let payload = decodeJSON(body)
      let address = (payload["address"] as? String)
        ?? chatGuidAddress(payload["chatGuid"] as? String)
        ?? ""
      let text = (payload["message"] as? String) ?? (payload["text"] as? String) ?? ""
      let sent = sender.send(address: address, body: text)
      let ok = sent["ok"] as? Bool ?? false
      return json(ok ? 200 : 502, [
        "status": ok ? 200 : 502,
        "message": ok ? "Success" : (sent["error"] as? String ?? "Send failed"),
        "data": sent,
      ])
    }

    if path == "/api/v1/chat" && method == "GET" {
      do {
        let chats = try store.listRecentChats(limit: 40)
        return json(200, ["status": 200, "message": "Success", "data": chats])
      } catch {
        return json(500, ["status": 500, "message": error.localizedDescription])
      }
    }

    return json(404, ["status": 404, "message": "Not found", "hint": "BEVEL native iMessage host"])
  }

  private func authorized(query: [String: String], headers: [String: String]) -> Bool {
    if password.isEmpty { return true }
    if query["password"] == password { return true }
    let auth = headers["authorization"] ?? ""
    if auth == "Bearer \(password)" { return true }
    if auth == password { return true }
    return false
  }

  private func chatGuidAddress(_ guid: String?) -> String? {
    guard let guid, guid.contains(";-;") else { return guid }
    return guid.split(separator: ";").last.map(String.init)
  }

  private func parseQuery(_ q: String) -> [String: String] {
    var out: [String: String] = [:]
    for pair in q.split(separator: "&") {
      let kv = pair.split(separator: "=", maxSplits: 1)
      if kv.isEmpty { continue }
      let key = kv[0].removingPercentEncoding ?? String(kv[0])
      let val = kv.count > 1 ? (kv[1].removingPercentEncoding ?? String(kv[1])) : ""
      out[key] = val
    }
    return out
  }

  private func decodeJSON(_ body: String) -> [String: Any] {
    guard let data = body.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data),
          let map = obj as? [String: Any]
    else { return [:] }
    return map
  }

  private func json(_ status: Int, _ obj: [String: Any]) -> Data {
    let data = (try? JSONSerialization.data(withJSONObject: obj)) ?? Data("{}".utf8)
    let phrase = status == 200 ? "OK" : "Error"
    let head = """
      HTTP/1.1 \(status) \(phrase)\r
      Content-Type: application/json\r
      Content-Length: \(data.count)\r
      Connection: close\r
      \r

      """
    var out = Data(head.utf8)
    out.append(data)
    return out
  }
}

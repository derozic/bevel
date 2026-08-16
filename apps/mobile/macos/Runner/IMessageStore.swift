import Foundation
import SQLite3

/// Read-only access to the local Messages `chat.db`.
///
/// Public Apple schema only — no private API, no Messages inject.
/// Requires Full Disk Access. Open read-only with URI so Messages.app
/// can keep the WAL lock.
final class IMessageStore {
  static let chatRelativePath = "Library/Messages/chat.db"

  /// Seconds between 1970-01-01 and Apple's 2001-01-01 epoch.
  static let appleEpoch: Double = 978_307_200

  private var watchTimer: Timer?
  private var lastRowID: Int64 = 0
  private var onMessage: (([String: Any]) -> Void)?

  var chatDBPath: String {
    FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent(Self.chatRelativePath)
      .path
  }

  var databaseExists: Bool {
    FileManager.default.fileExists(atPath: chatDBPath)
  }

  /// Convert an Apple Messages `date` column to unix milliseconds.
  /// Modern macOS stores nanoseconds since 2001-01-01; older rows are seconds.
  static func appleDateToUnixMs(_ value: Int64) -> Int64 {
    let seconds: Double
    let magnitude = abs(value)
    // High Sierra+ stores nanoseconds since 2001 (~1e17 today).
    // 1e12 ns == 1 second — anything larger is nanoseconds, not seconds.
    if magnitude >= 1_000_000_000_000 {
      seconds = Double(value) / 1_000_000_000.0
    } else {
      seconds = Double(value)
    }
    return Int64((seconds + appleEpoch) * 1000.0)
  }

  func probeAccess() -> [String: Any] {
    if !databaseExists {
      return [
        "readable": false,
        "exists": false,
        "path": chatDBPath,
        "error": "Messages database not found. Sign into Messages.app on this Mac.",
      ]
    }
    do {
      let db = try open()
      defer { sqlite3_close(db) }
      var stmt: OpaquePointer?
      let sql = "SELECT COUNT(*) FROM message"
      guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
        let err = String(cString: sqlite3_errmsg(db))
        return [
          "readable": false,
          "exists": true,
          "path": chatDBPath,
          "error": "Cannot query chat.db (\(err)). Grant Full Disk Access to BEVEL.",
        ]
      }
      defer { sqlite3_finalize(stmt) }
      var count: Int64 = 0
      if sqlite3_step(stmt) == SQLITE_ROW {
        count = sqlite3_column_int64(stmt, 0)
      }
      return [
        "readable": true,
        "exists": true,
        "path": chatDBPath,
        "messageCount": count,
      ]
    } catch {
      return [
        "readable": false,
        "exists": true,
        "path": chatDBPath,
        "error": "\(error.localizedDescription). Grant Full Disk Access to BEVEL.",
      ]
    }
  }

  func listRecentChats(limit: Int = 40) throws -> [[String: Any]] {
    let db = try open()
    defer { sqlite3_close(db) }
    let capped = max(1, min(limit, 200))
    let sql = """
      SELECT
        c.guid,
        c.chat_identifier,
        IFNULL(c.display_name, ''),
        c.style,
        m.guid,
        m.text,
        m.attributedBody,
        m.is_from_me,
        m.date,
        IFNULL(h.id, '')
      FROM chat c
      JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
      JOIN message m ON m.ROWID = cmj.message_id
      LEFT JOIN handle h ON h.ROWID = m.handle_id
      WHERE m.ROWID = (
        SELECT MAX(cmj2.message_id) FROM chat_message_join cmj2 WHERE cmj2.chat_id = c.ROWID
      )
      ORDER BY m.date DESC
      LIMIT \(capped);
      """
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
      throw StoreError.query(String(cString: sqlite3_errmsg(db)))
    }
    defer { sqlite3_finalize(stmt) }

    var rows: [[String: Any]] = []
    while sqlite3_step(stmt) == SQLITE_ROW {
      let text = columnText(stmt, 5)
      let attributed = columnBlobString(stmt, 6)
      let body = (text?.isEmpty == false ? text : attributed) ?? ""
      rows.append([
        "chatGuid": columnText(stmt, 0) ?? "",
        "chatIdentifier": columnText(stmt, 1) ?? "",
        "displayName": columnText(stmt, 2) ?? "",
        "style": Int(sqlite3_column_int(stmt, 3)),
        "lastGuid": columnText(stmt, 4) ?? "",
        "lastBody": String(body.prefix(280)),
        "isFromMe": sqlite3_column_int(stmt, 7) == 1,
        "ts": Self.appleDateToUnixMs(sqlite3_column_int64(stmt, 8)),
        "handle": columnText(stmt, 9) ?? "",
      ])
    }
    return rows
  }

  func startWatching(onMessage: @escaping ([String: Any]) -> Void) {
    stopWatching()
    self.onMessage = onMessage
    lastRowID = (try? maxRowID()) ?? 0
    let timer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self] _ in
      self?.pollNew()
    }
    RunLoop.main.add(timer, forMode: .common)
    watchTimer = timer
  }

  func stopWatching() {
    watchTimer?.invalidate()
    watchTimer = nil
    onMessage = nil
  }

  private func pollNew() {
    do {
      let fresh = try messagesAfter(rowID: lastRowID, limit: 50)
      for row in fresh {
        if let rid = row["rowid"] as? Int64, rid > lastRowID {
          lastRowID = rid
        }
        onMessage?(row)
      }
    } catch {
      // Stay quiet on transient WAL races; next tick retries.
    }
  }

  private func maxRowID() throws -> Int64 {
    let db = try open()
    defer { sqlite3_close(db) }
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, "SELECT IFNULL(MAX(ROWID), 0) FROM message", -1, &stmt, nil) == SQLITE_OK else {
      throw StoreError.query(String(cString: sqlite3_errmsg(db)))
    }
    defer { sqlite3_finalize(stmt) }
    if sqlite3_step(stmt) == SQLITE_ROW {
      return sqlite3_column_int64(stmt, 0)
    }
    return 0
  }

  private func messagesAfter(rowID: Int64, limit: Int) throws -> [[String: Any]] {
    let db = try open()
    defer { sqlite3_close(db) }
    let sql = """
      SELECT
        m.ROWID,
        m.guid,
        m.text,
        m.attributedBody,
        m.is_from_me,
        m.date,
        IFNULL(h.id, ''),
        IFNULL(c.guid, '')
      FROM message m
      LEFT JOIN handle h ON h.ROWID = m.handle_id
      LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      LEFT JOIN chat c ON c.ROWID = cmj.chat_id
      WHERE m.ROWID > ?
      ORDER BY m.ROWID ASC
      LIMIT ?;
      """
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
      throw StoreError.query(String(cString: sqlite3_errmsg(db)))
    }
    defer { sqlite3_finalize(stmt) }
    sqlite3_bind_int64(stmt, 1, rowID)
    sqlite3_bind_int(stmt, 2, Int32(limit))

    var rows: [[String: Any]] = []
    while sqlite3_step(stmt) == SQLITE_ROW {
      let text = columnText(stmt, 2)
      let attributed = columnBlobString(stmt, 3)
      let body = (text?.isEmpty == false ? text : attributed) ?? ""
      rows.append([
        "rowid": sqlite3_column_int64(stmt, 0),
        "guid": columnText(stmt, 1) ?? "",
        "body": body,
        "isFromMe": sqlite3_column_int(stmt, 4) == 1,
        "ts": Self.appleDateToUnixMs(sqlite3_column_int64(stmt, 5)),
        "handle": columnText(stmt, 6) ?? "",
        "chatGuid": columnText(stmt, 7) ?? "",
      ])
    }
    return rows
  }

  private func open() throws -> OpaquePointer {
    let uri = "file://\(chatDBPath)?mode=ro"
    var db: OpaquePointer?
    let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_URI | SQLITE_OPEN_FULLMUTEX
    let rc = sqlite3_open_v2(uri, &db, flags, nil)
    if rc != SQLITE_OK {
      let msg = db.map { String(cString: sqlite3_errmsg($0)) } ?? "sqlite open failed"
      if let db { sqlite3_close(db) }
      throw StoreError.open(msg)
    }
    guard let db else { throw StoreError.open("sqlite handle is nil") }
    sqlite3_busy_timeout(db, 800)
    return db
  }

  private func columnText(_ stmt: OpaquePointer?, _ index: Int32) -> String? {
    guard let ptr = sqlite3_column_text(stmt, index) else { return nil }
    return String(cString: ptr)
  }

  /// Best-effort UTF-8 extraction from `attributedBody` NSKeyedArchiver blobs.
  private func columnBlobString(_ stmt: OpaquePointer?, _ index: Int32) -> String? {
    let bytes = sqlite3_column_bytes(stmt, index)
    guard bytes > 0, let raw = sqlite3_column_blob(stmt, index) else { return nil }
    let data = Data(bytes: raw, count: Int(bytes))
    return Self.extractPlaintext(fromAttributedBody: data)
  }

  static func extractPlaintext(fromAttributedBody data: Data) -> String? {
    guard let asString = String(data: data, encoding: .utf8)
      ?? String(data: data, encoding: .ascii)
    else {
      var collected = ""
      var current = Data()
      for byte in data {
        if byte >= 32 && byte < 127 {
          current.append(byte)
        } else {
          if current.count >= 8, let chunk = String(data: current, encoding: .ascii) {
            if !chunk.contains("NS") && !chunk.contains("streamtyped") {
              collected += collected.isEmpty ? chunk : " \(chunk)"
            }
          }
          current.removeAll(keepingCapacity: true)
        }
      }
      return collected.isEmpty ? nil : collected
    }
    return asString
  }

  enum StoreError: LocalizedError {
    case open(String)
    case query(String)

    var errorDescription: String? {
      switch self {
      case .open(let m), .query(let m):
        return m
      }
    }
  }
}

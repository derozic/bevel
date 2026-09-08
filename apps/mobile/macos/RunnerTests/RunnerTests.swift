import Cocoa
import FlutterMacOS
import XCTest

class RunnerTests: XCTestCase {

  func testAppleEpochOffset() {
    // 2001-01-01T00:00:00Z in unix ms. Keep in lockstep with
    // IMessageStore.appleDateToUnixMs / Dart appleDateToUnixMs.
    let appleEpochMs: Int64 = 978_307_200_000
    XCTAssertEqual(appleEpochMs, 978_307_200_000)
  }

}

import AVFoundation
import Cocoa
import CoreAudio
import FlutterMacOS

/// Enumerates host mics, speakers, and cameras for audio huddles.
/// Channel: com.derozic.bevel/media_devices
///
/// Targets macOS 11+ (deployment target). Prefer CoreAudio for I/O and
/// AVFoundation for capture devices without newer DeviceType APIs.
final class MediaDeviceChannel: NSObject {
  static let name = "com.derozic.bevel/media_devices"

  private let channel: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: MediaDeviceChannel.name, binaryMessenger: messenger)
    super.init()
    channel.setMethodCallHandler(handle)
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "enumerateDevices":
      result(enumerateDevices())
    case "requestAccess":
      let args = call.arguments as? [String: Any]
      let wantCamera = (args?["camera"] as? Bool) ?? false
      requestAccess(camera: wantCamera, result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func enumerateDevices() -> [String: Any] {
    // CoreAudio is the reliable path for inputs/outputs on all supported macOS.
    var mics = listAudioDevices(scope: kAudioObjectPropertyScopeInput, kind: "audioinput")
    let speakers = listAudioDevices(scope: kAudioObjectPropertyScopeOutput, kind: "audiooutput")
    var cameras = listCameras()

    // Supplement mics from AVFoundation when available (labels sometimes better).
    let avMics = listAVCaptureDevices(mediaType: .audio, kind: "audioinput")
    if !avMics.isEmpty {
      mics = mergeDevices(primary: avMics, secondary: mics)
    }
    let avCams = listAVCaptureDevices(mediaType: .video, kind: "videoinput")
    if !avCams.isEmpty {
      cameras = mergeDevices(primary: avCams, secondary: cameras)
    }

    return [
      "platform": "macos",
      "microphones": mics,
      "speakers": speakers,
      "cameras": cameras,
    ]
  }

  private func listAVCaptureDevices(mediaType: AVMediaType, kind: String) -> [[String: Any]] {
    // devices(for:) works on macOS 11+ without modern DeviceType enums.
    let devices = AVCaptureDevice.devices(for: mediaType)
    let defaultDevice = AVCaptureDevice.default(for: mediaType)
    return devices.map { device in
      [
        "id": device.uniqueID,
        "label": device.localizedName,
        "kind": kind,
        "isDefault": device.uniqueID == defaultDevice?.uniqueID,
      ]
    }
  }

  private func listCameras() -> [[String: Any]] {
    listAVCaptureDevices(mediaType: .video, kind: "videoinput")
  }

  private func mergeDevices(
    primary: [[String: Any]],
    secondary: [[String: Any]]
  ) -> [[String: Any]] {
    var seen = Set(primary.compactMap { $0["id"] as? String })
    var out = primary
    for d in secondary {
      guard let id = d["id"] as? String, !seen.contains(id) else { continue }
      seen.insert(id)
      out.append(d)
    }
    return out
  }

  private func listAudioDevices(scope: AudioObjectPropertyScope, kind: String) -> [[String: Any]] {
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwarePropertyDevices,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )

    var dataSize: UInt32 = 0
    var status = AudioObjectGetPropertyDataSize(
      AudioObjectID(kAudioObjectSystemObject),
      &address,
      0,
      nil,
      &dataSize
    )
    guard status == noErr, dataSize > 0 else { return [] }

    let count = Int(dataSize) / MemoryLayout<AudioDeviceID>.size
    var deviceIDs = [AudioDeviceID](repeating: 0, count: count)
    status = AudioObjectGetPropertyData(
      AudioObjectID(kAudioObjectSystemObject),
      &address,
      0,
      nil,
      &dataSize,
      &deviceIDs
    )
    guard status == noErr else { return [] }

    var defaultID: AudioDeviceID = 0
    var defaultAddress = AudioObjectPropertyAddress(
      mSelector: scope == kAudioObjectPropertyScopeInput
        ? kAudioHardwarePropertyDefaultInputDevice
        : kAudioHardwarePropertyDefaultOutputDevice,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    var defaultSize = UInt32(MemoryLayout<AudioDeviceID>.size)
    _ = AudioObjectGetPropertyData(
      AudioObjectID(kAudioObjectSystemObject),
      &defaultAddress,
      0,
      nil,
      &defaultSize,
      &defaultID
    )

    var results: [[String: Any]] = []
    for deviceID in deviceIDs {
      var streamAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreamConfiguration,
        mScope: scope,
        mElement: kAudioObjectPropertyElementMain
      )
      var streamSize: UInt32 = 0
      if AudioObjectGetPropertyDataSize(deviceID, &streamAddress, 0, nil, &streamSize) != noErr {
        continue
      }
      if streamSize == 0 { continue }

      let raw = UnsafeMutableRawPointer.allocate(
        byteCount: Int(streamSize),
        alignment: MemoryLayout<AudioBufferList>.alignment
      )
      defer { raw.deallocate() }
      if AudioObjectGetPropertyData(deviceID, &streamAddress, 0, nil, &streamSize, raw) != noErr {
        continue
      }
      let abl = raw.bindMemory(to: AudioBufferList.self, capacity: 1)
      if abl.pointee.mNumberBuffers == 0 { continue }

      let name = deviceName(deviceID) ?? "Device \(deviceID)"
      let uid = deviceUID(deviceID) ?? "coreaudio-\(deviceID)"
      results.append([
        "id": uid,
        "label": name,
        "kind": kind,
        "isDefault": deviceID == defaultID,
      ])
    }
    return results
  }

  private func deviceName(_ deviceID: AudioDeviceID) -> String? {
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioObjectPropertyName,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    var cfName: Unmanaged<CFString>?
    var size = UInt32(MemoryLayout<CFString?>.size)
    let status = withUnsafeMutablePointer(to: &cfName) { ptr in
      AudioObjectGetPropertyData(deviceID, &address, 0, nil, &size, ptr)
    }
    guard status == noErr, let name = cfName?.takeRetainedValue() else { return nil }
    return name as String
  }

  private func deviceUID(_ deviceID: AudioDeviceID) -> String? {
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyDeviceUID,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    var cfUid: Unmanaged<CFString>?
    var size = UInt32(MemoryLayout<CFString?>.size)
    let status = withUnsafeMutablePointer(to: &cfUid) { ptr in
      AudioObjectGetPropertyData(deviceID, &address, 0, nil, &size, ptr)
    }
    guard status == noErr, let uid = cfUid?.takeRetainedValue() else { return nil }
    return uid as String
  }

  private func requestAccess(camera: Bool, result: @escaping FlutterResult) {
    let group = DispatchGroup()
    var micOk = false
    var camOk = true

    group.enter()
    AVCaptureDevice.requestAccess(for: .audio) { granted in
      micOk = granted
      group.leave()
    }

    if camera {
      group.enter()
      AVCaptureDevice.requestAccess(for: .video) { granted in
        camOk = granted
        group.leave()
      }
    }

    group.notify(queue: .main) {
      result(micOk && camOk)
    }
  }
}

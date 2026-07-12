import type { PermissionState } from '@bevel/schema'

export type BrowserPermissionName = 'notifications' | 'camera' | 'microphone'

export function mapNotificationPermission(
  perm: NotificationPermission | undefined,
): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (perm === 'granted') return 'granted'
  if (perm === 'denied') return 'denied'
  return 'prompt'
}

export function getNotificationPermission(): PermissionState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported'
  }
  return mapNotificationPermission(Notification.permission)
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const result = await Notification.requestPermission()
    return mapNotificationPermission(result)
  } catch {
    return 'denied'
  }
}

export async function queryMediaPermission(
  kind: 'camera' | 'microphone',
): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported'
  }
  const permName = kind === 'camera' ? 'camera' : 'microphone'
  try {
    // permissions.query is not universal for mic/camera on all browsers
    const status = await navigator.permissions?.query?.({
      name: permName as PermissionName,
    })
    if (status) {
      if (status.state === 'granted') return 'granted'
      if (status.state === 'denied') return 'denied'
      return 'prompt'
    }
  } catch {
    // fall through — unknown until we try getUserMedia
  }
  return 'prompt'
}

/** Request access then immediately stop tracks (permission probe only). */
export async function requestMediaPermission(
  kind: 'camera' | 'microphone',
): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported'
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === 'camera' ? { video: true, audio: false } : { video: false, audio: true },
    )
    for (const track of stream.getTracks()) {
      track.stop()
    }
    return 'granted'
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'denied'
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'unsupported'
    }
    return 'denied'
  }
}

export async function listMediaDevices(
  kind: 'videoinput' | 'audioinput' | 'audiooutput',
): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return []
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === kind)
  } catch {
    return []
  }
}

/** Open a live camera/mic stream with preferred device ids and processing flags. */
export async function openMediaPreview(options: {
  video?: boolean
  audio?: boolean
  cameraId?: string
  micId?: string
  autoGainControl?: boolean
  noiseSuppression?: boolean
  echoCancellation?: boolean
}): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null
  }
  try {
    const constraints: MediaStreamConstraints = {}
    if (options.video) {
      constraints.video = options.cameraId
        ? { deviceId: { exact: options.cameraId } }
        : true
    }
    if (options.audio) {
      constraints.audio = {
        ...(options.micId ? { deviceId: { exact: options.micId } } : {}),
        autoGainControl: options.autoGainControl ?? true,
        noiseSuppression: options.noiseSuppression ?? true,
        echoCancellation: options.echoCancellation ?? true,
      }
    }
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch {
    return null
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

/** Play a short sine tone on the preferred speaker (when setSinkId is available). */
export async function playSpeakerTestTone(
  speakerId?: string,
  durationMs = 600,
): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 440
    gain.gain.value = 0.08
    osc.connect(gain)
    gain.connect(ctx.destination)

    const dest = ctx.destination as AudioDestinationNode & {
      setSinkId?: (id: string) => Promise<void>
    }
    if (speakerId && typeof dest.setSinkId === 'function') {
      await dest.setSinkId(speakerId)
    }

    osc.start()
    await new Promise((r) => setTimeout(r, durationMs))
    osc.stop()
    await ctx.close()
    return true
  } catch {
    return false
  }
}

export function permissionLabel(state: PermissionState): string {
  switch (state) {
    case 'granted':
      return 'Allowed'
    case 'denied':
      return 'Blocked'
    case 'unsupported':
      return 'Unavailable'
    default:
      return 'Not set'
  }
}

/**
 * WebRTC feature module — audio/video/screen only.
 *
 * Do NOT route general chat/presence through this package.
 * Use @bevel/realtime-client (WebSocket) for live bidirectional state.
 * Use @bevel/async-stream (SSE) for one-way updates.
 */

export type WebRtcSessionConfig = {
  tenantId: string
  namespace: string
  signalingUrl: string
  modes: Array<'audio' | 'video' | 'screen'>
}

export function createWebRtcSession(config: WebRtcSessionConfig) {
  return {
    config,
    connect: async () => {
      throw new Error(
        '@bevel/feature-webrtc is not enabled — opt in via features.live_media in bevel.yaml',
      )
    },
  }
}
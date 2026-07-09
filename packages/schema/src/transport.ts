import { z } from 'zod'

/**
 * BEVEL transport layers — keep implementations isolated per layer.
 *
 * 1. Async stream  — SSE / streamed HTTP (one-way server → client)
 * 2. Live bidirectional — WebSockets via services/realtime + realtime-client
 * 3. Live media — WebRTC feature module only (not general realtime)
 */

export const AsyncStreamTransportSchema = z.object({
  kind: z.literal('async-stream'),
  protocol: z.enum(['sse', 'stream-http']).default('sse'),
  /** AI responses, progress, notifications, activity feeds, long-running jobs */
  useCases: z
    .array(
      z.enum([
        'ai-response',
        'progress',
        'notification',
        'activity-feed',
        'long-running-job',
      ]),
    )
    .default(['ai-response', 'progress', 'notification']),
})

export const LiveBidirectionalTransportSchema = z.object({
  kind: z.literal('live-bidirectional'),
  protocol: z.literal('websocket'),
  /** Collaboration, presence, chat, shared sessions, live control */
  useCases: z
    .array(
      z.enum([
        'collaboration',
        'presence',
        'chat',
        'shared-session',
        'live-control',
      ]),
    )
    .default(['chat', 'presence', 'shared-session']),
  /** Isolated behind services/realtime — not coupled to Vercel/Cloudflare host */
  isolatedService: z.literal('realtime').default('realtime'),
})

export const LiveMediaTransportSchema = z.object({
  kind: z.literal('live-media'),
  protocol: z.literal('webrtc'),
  /** Audio/video/screen only — opt-in feature module */
  useCases: z
    .array(z.enum(['audio', 'video', 'screen']))
    .default(['audio', 'video']),
  module: z.literal('@bevel/feature-webrtc').default('@bevel/feature-webrtc'),
})

export const TenantTransportsSchema = z.object({
  asyncStream: AsyncStreamTransportSchema.optional(),
  liveBidirectional: LiveBidirectionalTransportSchema.optional(),
  liveMedia: LiveMediaTransportSchema.optional(),
})

export type AsyncStreamTransport = z.infer<typeof AsyncStreamTransportSchema>
export type LiveBidirectionalTransport = z.infer<
  typeof LiveBidirectionalTransportSchema
>
export type LiveMediaTransport = z.infer<typeof LiveMediaTransportSchema>
export type TenantTransports = z.infer<typeof TenantTransportsSchema>
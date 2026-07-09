import type { AsyncStreamEvent } from './types'
import { formatSseMessage } from './types'

export type SseStreamOptions = {
  tenantId: string
  namespace: string
  heartbeatMs?: number
}

/** Create a ReadableStream for Next.js / Vercel Functions SSE responses. */
export function createSseStream(
  producer: (
    emit: (event: AsyncStreamEvent) => void,
    signal: AbortSignal,
  ) => void | Promise<void>,
  options: SseStreamOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const heartbeatMs = options.heartbeatMs ?? 15_000

  return new ReadableStream({
    start(controller) {
      const ac = new AbortController()

      const emit = (event: AsyncStreamEvent) => {
        controller.enqueue(encoder.encode(formatSseMessage(event)))
      }

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, heartbeatMs)

      void Promise.resolve(producer(emit, ac.signal))
        .catch(() => {})
        .finally(() => {
          clearInterval(heartbeat)
          controller.close()
        })

      return () => {
        ac.abort()
        clearInterval(heartbeat)
      }
    },
    cancel() {
      // consumer disconnected
    },
  })
}

export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
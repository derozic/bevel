import type { AsyncStreamEvent } from './types'

export type AsyncStreamClientOptions = {
  url: string
  tenantId?: string
  onEvent: (event: AsyncStreamEvent) => void
  onError?: (err: Error) => void
}

/** Browser SSE consumer — use for AI deltas, progress, notifications. */
export function connectAsyncStream(options: AsyncStreamClientOptions): () => void {
  const source = new EventSource(options.url)

  source.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as AsyncStreamEvent
      options.onEvent(event)
    } catch {
      // ignore malformed frames
    }
  }

  for (const type of [
    'ai.delta',
    'ai.done',
    'progress',
    'notification',
    'activity',
    'job.started',
    'job.updated',
    'job.completed',
    'job.failed',
  ] as const) {
    source.addEventListener(type, (msg) => {
      try {
        const event = JSON.parse((msg as MessageEvent).data) as AsyncStreamEvent
        options.onEvent(event)
      } catch {
        // ignore
      }
    })
  }

  source.onerror = () => {
    options.onError?.(new Error('SSE connection error'))
  }

  return () => source.close()
}
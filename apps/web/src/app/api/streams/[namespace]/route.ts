import { requireTenantFromRequest } from '@bevel/tenant-config'
import { createSseStream, sseResponse } from '@bevel/async-stream/server'
import type { AsyncStreamEvent } from '@bevel/async-stream'

/**
 * Async stream transport (SSE) — one-way server → client.
 * Use for AI deltas, progress, notifications, activity feeds, long-running jobs.
 * Live bidirectional chat/presence stays on services/realtime (WebSocket).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ namespace: string }> },
) {
  const tenant = await requireTenantFromRequest()
  const { namespace } = await context.params

  if (namespace !== tenant.realtime.namespace) {
    return new Response('Namespace mismatch', { status: 403 })
  }

  const stream = createSseStream(
    (emit) => {
      const welcome: AsyncStreamEvent = {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        namespace,
        type: 'notification',
        timestamp: new Date().toISOString(),
        payload: { message: 'async stream connected', transport: 'sse' },
      }
      emit(welcome)
    },
    { tenantId: tenant.id, namespace },
  )

  return sseResponse(stream)
}
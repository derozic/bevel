/**
 * Best-effort AgentTrace ingest into bevel-api.
 * Never blocks agent replies; failures are silent.
 */
import { randomUUID } from 'node:crypto'

function apiBase(): string | null {
  return process.env.API_INTERNAL_URL ?? process.env.FLEET_CHANNEL_API_URL ?? null
}

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.FLEET_INTERNAL_API_KEY
  if (key) headers['X-Fleet-Internal-Key'] = key
  return headers
}

export type TraceEmitContext = {
  tenantId?: string
  /** Matches packages/schema TraceRoomKind: channel | agent_session | … */
  roomKind: 'channel' | 'agent_session' | 'computer' | 'cloud'
  roomId: string
  agentId: string
  messageId?: string
}

export function newRunId(): string {
  return `run_${randomUUID().replace(/-/g, '').slice(0, 16)}`
}

export async function emitTraceEvents(
  events: Array<{
    tenantId: string
    runId: string
    roomKind: string
    roomId: string
    agentId: string
    messageId?: string
    kind: string
    title: string
    summary?: string
    status?: string
    payload?: Record<string, unknown>
    durationMs?: number
  }>,
): Promise<void> {
  const base = apiBase()
  if (!base || events.length === 0) return
  try {
    await fetch(`${base}/api/v1/traces`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(4_000),
    })
  } catch {
    // best-effort
  }
}

export async function emitDispatchTrace(opts: {
  ctx: TraceEmitContext
  runId: string
  phase: 'start' | 'ok' | 'error'
  title: string
  summary?: string
  model?: string
  errorCode?: string
  durationMs?: number
}): Promise<void> {
  // Must match web TracePane tenantId (session.tenantSlug || NEXT_PUBLIC_DEFAULT_TENANT || 2x4m)
  const tenantId =
    opts.ctx.tenantId ||
    process.env.BEVEL_DEFAULT_TENANT ||
    process.env.DEFAULT_TENANT_SLUG ||
    '2x4m'
  const kind =
    opts.phase === 'start' ? 'run_start' : opts.phase === 'ok' ? 'run_end' : 'run_error'
  const status = opts.phase === 'error' ? 'error' : opts.phase === 'ok' ? 'ok' : 'running'
  await emitTraceEvents([
    {
      tenantId,
      runId: opts.runId,
      roomKind: opts.ctx.roomKind,
      roomId: opts.ctx.roomId,
      agentId: opts.ctx.agentId,
      messageId: opts.ctx.messageId,
      kind,
      title: opts.title,
      summary: opts.summary,
      status,
      durationMs: opts.durationMs,
      payload: {
        model: opts.model,
        errorCode: opts.errorCode,
        phase: opts.phase,
      },
    },
  ])
}

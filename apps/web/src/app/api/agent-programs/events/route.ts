import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

/**
 * Ingest agent program runs (e.g. JOHNNY Caddy heal) as BEVEL channel messages.
 *
 * Auth: session cookie, X-Fleet-Internal-Key, or loopback in development
 * (agent scripts / launchd without a key).
 *
 * Pipeline:
 *  1. Persist to FastAPI fleet messages (JSONL) for hydrate on next join
 *  2. Inject into live Colyseus fleet_channel rooms (realtime)
 *  3. Return notify payload for PWA / desktop / Flutter clients
 */

type ProgramEventBody = {
  agentId?: string
  programId?: string
  title?: string
  body?: string
  message?: string
  severity?: 'info' | 'warning' | 'critical'
  channelSlug?: string
  tenantSlug?: string
}

function clientHost(request: Request): string {
  // Prefer direct socket info when present (Node); fall back to forwarded
  const xf = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (xf) return xf
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return ''
}

function isLoopback(host: string): boolean {
  return (
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'localhost' ||
    host.endsWith('127.0.0.1') ||
    host === '::ffff:127.0.0.1'
  )
}

function internalKeyOk(request: Request): boolean {
  const key = process.env.FLEET_INTERNAL_API_KEY
  const header = request.headers.get('x-fleet-internal-key')
  if (key && header === key) return true
  return false
}

function authorized(request: Request, hasSession: boolean): boolean {
  if (hasSession) return true
  if (internalKeyOk(request)) return true
  // Local agent programs without a shared secret
  if (process.env.NODE_ENV !== 'production') {
    const host = clientHost(request)
    // Caddy terminates TLS and may set X-Forwarded-For to the real client.
    // Also allow when no forward headers (direct Next hit on loopback).
    if (!host || isLoopback(host)) return true
  }
  // No key configured: still require loopback
  if (!process.env.FLEET_INTERNAL_API_KEY) {
    const host = clientHost(request)
    if (!host || isLoopback(host)) return true
  }
  return false
}

function formatProgramMessage(input: ProgramEventBody): {
  agentId: string
  speakerName: string
  body: string
  tags: string[]
} {
  const agentId = (input.agentId || 'johnny').toLowerCase()
  const speakerName = agentId.toUpperCase()
  const title = (input.title || 'Program update').trim()
  const detail = (input.body || input.message || '').trim()
  const severity = input.severity || 'info'
  const programId = input.programId || 'program'
  const body = [
    `[program:${programId}] ${title}`,
    detail,
    severity !== 'info' ? `severity: ${severity}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    agentId,
    speakerName,
    body,
    tags: ['program', agentId, programId, severity],
  }
}

function apiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.FLEET_CHANNEL_API_URL ||
    'http://127.0.0.1:43203'
  )
}

function realtimeBase(): string {
  return (
    process.env.REALTIME_INTERNAL_URL ||
    process.env.AGENTS_REALTIME_URL ||
    'http://127.0.0.1:43208'
  )
}

function fleetHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const fleetKey = process.env.FLEET_INTERNAL_API_KEY
  if (fleetKey) headers['X-Fleet-Internal-Key'] = fleetKey
  return headers
}

export async function POST(request: Request) {
  const session = await auth()
  if (!authorized(request, Boolean(session?.user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let raw: ProgramEventBody
  try {
    raw = (await request.json()) as ProgramEventBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!raw.title && !raw.body && !raw.message) {
    return NextResponse.json(
      { error: 'title or body required' },
      { status: 400 },
    )
  }

  const channelSlug = (raw.channelSlug || 'general').toLowerCase()
  const formatted = formatProgramMessage(raw)
  const msgId = `prog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const headers = fleetHeaders()

  let persisted = false
  try {
    const res = await fetch(
      `${apiBase()}/api/v1/fleet/channels/${encodeURIComponent(channelSlug)}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: msgId,
          speakerId: `agent:${formatted.agentId}`,
          speakerName: formatted.speakerName,
          speakerType: 'agent',
          agentId: formatted.agentId,
          body: formatted.body,
          status: 'final',
          tags: formatted.tags,
        }),
      },
    )
    persisted = res.ok
  } catch {
    persisted = false
  }

  let liveInjected = 0
  try {
    const res = await fetch(`${realtimeBase()}/api/program-events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: msgId,
        agentId: formatted.agentId,
        speakerName: formatted.speakerName,
        body: formatted.body,
        channelSlug,
        tags: formatted.tags,
        // Already persisted above — avoid double-write when room injects
        persist: !persisted,
      }),
    })
    if (res.ok) {
      const data = (await res.json()) as { injected?: unknown[] }
      liveInjected = Array.isArray(data.injected) ? data.injected.length : 0
    }
  } catch {
    liveInjected = 0
  }

  const notify = {
    title: raw.title || `${formatted.speakerName}`,
    body: (raw.body || raw.message || formatted.body).slice(0, 280),
    agentId: formatted.agentId,
    programId: raw.programId || 'program',
    severity: raw.severity || 'info',
    url: `/^${channelSlug}`,
    tag: `program-${formatted.agentId}-${msgId}`,
  }

  // Accountability: also mirror program runs into ^product (GitHub ops trail)
  let product: { ok: boolean; messageId?: string } | null = null
  if (channelSlug !== 'product') {
    try {
      const { postProductChannelMessage } = await import('@/lib/product-channel')
      product = await postProductChannelMessage({
        kind: 'program',
        agentId: formatted.agentId,
        agentName: formatted.speakerName,
        title: raw.title || 'Program update',
        body: raw.body || raw.message || formatted.body,
        repo: process.env.BEVEL_WORK_REPO || 'derozic/2x4m',
      })
    } catch {
      product = null
    }
  }

  return NextResponse.json({
    ok: true,
    messageId: msgId,
    channelSlug,
    persisted,
    liveInjected,
    product,
    notify,
  })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST agent program events (JOHNNY Caddy heal, etc.) to turn them into channel messages + notification payloads for PWA, macOS desktop, and Flutter.',
    example: {
      agentId: 'johnny',
      programId: 'caddy-heal',
      title: 'JOHNNY: Caddy healed',
      body: 'Reloaded Caddyfile.global after rogue instance on :443',
      severity: 'warning',
      channelSlug: 'general',
    },
    clients: {
      pwa: 'Service worker + Notification API (install BEVEL from browser)',
      desktop: 'macOS app consumes same channel stream / notify schema',
      flutter: 'Same Colyseus channel + notify payload',
    },
  })
}

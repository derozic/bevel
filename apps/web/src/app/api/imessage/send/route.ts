import { NextResponse } from 'next/server'
import {
  getBlueBubblesConfigFromEnv,
  isBlueBubblesConfigured,
  sendIMessage,
} from '@/lib/bluebubbles/client'

/**
 * POST /api/imessage/send
 * { "to": "+15551234567", "body": "You have a new BEVEL workspace" }
 *
 * Platform/dev helper to exercise local BlueBubbles.
 *
 * Auth (production-hardened):
 * - Production: requires x-fleet-internal-key matching FLEET_INTERNAL_API_KEY
 * - Development: open if FLEET_INTERNAL_API_KEY unset; if set, key is required
 *
 * Body limits: to <= 64 chars, body <= 1500 (iMessage-friendly).
 */

function authorize(req: Request): boolean {
  const expected = process.env.FLEET_INTERNAL_API_KEY?.trim()
  const internal = req.headers.get('x-fleet-internal-key')?.trim()
  const isProd = process.env.NODE_ENV === 'production'

  if (isProd) {
    if (!expected) {
      // Fail closed: do not allow open iMessage send in production without a key
      return false
    }
    return Boolean(internal && internal === expected)
  }

  // Dev: if a key is configured, require it; otherwise allow local testing
  if (expected) {
    return Boolean(internal && internal === expected)
  }
  return true
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { to?: string; body?: string }
  try {
    body = (await req.json()) as { to?: string; body?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const to = body.to?.trim() || ''
  const text = body.body?.trim() || ''

  if (!to || !text) {
    return NextResponse.json(
      { error: 'to and body are required' },
      { status: 400 },
    )
  }
  if (to.length > 64) {
    return NextResponse.json({ error: 'to too long' }, { status: 400 })
  }
  if (text.length > 1500) {
    return NextResponse.json({ error: 'body too long (max 1500)' }, { status: 400 })
  }

  const cfg = getBlueBubblesConfigFromEnv()
  const result = await sendIMessage({
    to,
    body: text,
    cfg,
    allowSimulate: process.env.NODE_ENV !== 'production',
  })

  return NextResponse.json(
    {
      ok: result.ok,
      status: result.status,
      simulated: result.simulated,
      error: result.error,
      // Do not echo full BlueBubbles raw payloads (may include PII)
      configured: isBlueBubblesConfigured(cfg),
      guide: 'docs/BLUEBUBBLES_IMESSAGE.md',
    },
    { status: result.ok ? 200 : result.status || 502 },
  )
}

export async function GET(req: Request) {
  // Status probe: no secrets; production still requires fleet key when configured
  if (process.env.NODE_ENV === 'production') {
    if (!authorize(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const cfg = getBlueBubblesConfigFromEnv()
  return NextResponse.json({
    configured: isBlueBubblesConfigured(cfg),
    // Never return password; only host form
    url: cfg.url
      ? cfg.url.replace(/\/\/([^/@]+)@/, '//***@')
      : null,
    hint: isBlueBubblesConfigured(cfg)
      ? 'POST /api/imessage/send with { to, body }'
      : 'Set BLUEBUBBLES_URL + BLUEBUBBLES_PASSWORD; install BlueBubbles on this Mac',
    hermesPrompt: cfg.url || 'http://127.0.0.1:1234',
    docs: 'docs/BLUEBUBBLES_IMESSAGE.md',
  })
}

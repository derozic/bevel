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
 * Production should gate with FLEET_INTERNAL_API_KEY or session admin.
 */
export async function POST(req: Request) {
  const internal = req.headers.get('x-fleet-internal-key')
  const expected = process.env.FLEET_INTERNAL_API_KEY
  if (expected && internal !== expected) {
    // Allow unauthenticated only in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { to?: string; body?: string }
  try {
    body = (await req.json()) as { to?: string; body?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.to?.trim() || !body.body?.trim()) {
    return NextResponse.json(
      { error: 'to and body are required' },
      { status: 400 },
    )
  }

  const cfg = getBlueBubblesConfigFromEnv()
  const result = await sendIMessage({
    to: body.to,
    body: body.body,
    cfg,
    allowSimulate: true,
  })

  return NextResponse.json(
    {
      ...result,
      configured: isBlueBubblesConfigured(cfg),
      guide: 'docs/BLUEBUBBLES_IMESSAGE.md',
    },
    { status: result.ok ? 200 : result.status || 502 },
  )
}

export async function GET() {
  const cfg = getBlueBubblesConfigFromEnv()
  return NextResponse.json({
    configured: isBlueBubblesConfigured(cfg),
    url: cfg.url ? cfg.url.replace(/\/\/.*@/, '//') : null,
    hint: isBlueBubblesConfigured(cfg)
      ? 'POST /api/imessage/send with { to, body }'
      : 'Set BLUEBUBBLES_URL + BLUEBUBBLES_PASSWORD; install BlueBubbles on this Mac',
    hermesPrompt: cfg.url || 'http://127.0.0.1:1234',
    docs: '/docs or docs/BLUEBUBBLES_IMESSAGE.md',
  })
}

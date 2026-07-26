import { NextResponse } from 'next/server'
import {
  slackSigningSecret,
  verifySlackSignature,
} from '@/lib/slack/oauth'

/**
 * Slack Events API endpoint.
 * Phase 0: URL verification + signature check + log.
 * Phase 2: app_mention, slash → BEVEL handoffs.
 *
 * Security:
 * - url_verification returns challenge without requiring signature (Slack handshake)
 * - all other events require valid HMAC when SLACK_SIGNING_SECRET is set
 * - production refuses unsigned events if signing secret is missing (fail closed)
 */
export async function POST(req: Request) {
  const rawBody = await req.text()
  // Cap body size to limit abuse (events are small)
  if (rawBody.length > 256_000) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // URL verification challenge (Slack may send before full signature path is ready)
  if (payload.type === 'url_verification') {
    const challenge = payload.challenge
    if (typeof challenge !== 'string' || challenge.length > 512) {
      return NextResponse.json({ error: 'Invalid challenge' }, { status: 400 })
    }
    return NextResponse.json({ challenge })
  }

  const secret = slackSigningSecret()
  const isProd = process.env.NODE_ENV === 'production'
  if (!secret) {
    if (isProd) {
      console.error('[slack/events] SLACK_SIGNING_SECRET missing in production')
      return NextResponse.json(
        { error: 'Signing secret not configured' },
        { status: 503 },
      )
    }
    // Dev: allow unsigned events for local socket / tunnel experiments
  } else {
    const signature = req.headers.get('x-slack-signature') || ''
    const timestamp = req.headers.get('x-slack-request-timestamp') || ''
    const ok = await verifySlackSignature({
      signingSecret: secret,
      signature,
      timestamp,
      rawBody,
    })
    if (!ok) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const event = payload.event as Record<string, unknown> | undefined
  if (event?.type === 'app_mention') {
    // Phase 2: route to fleet / agent — never log full message bodies at info
    console.info('[slack/events] app_mention', {
      user: event.user,
      channel: event.channel,
      textLen: String(event.text || '').length,
    })
  }

  return NextResponse.json({ ok: true })
}

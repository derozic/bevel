import { NextResponse } from 'next/server'
import {
  slackSigningSecret,
  verifySlackSignature,
} from '@/lib/slack/oauth'

/**
 * Slack Events API endpoint.
 * Phase 0: URL verification + signature check + log.
 * Phase 2: app_mention, slash → BEVEL handoffs.
 */
export async function POST(req: Request) {
  const rawBody = await req.text()
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // URL verification challenge (before signature if Slack sends unsigned — still verify when secret set)
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  const secret = slackSigningSecret()
  if (secret) {
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
    // Phase 2: route to fleet / agent
    console.info('[slack/events] app_mention', {
      user: event.user,
      channel: event.channel,
      text: String(event.text || '').slice(0, 200),
    })
  }

  return NextResponse.json({ ok: true })
}

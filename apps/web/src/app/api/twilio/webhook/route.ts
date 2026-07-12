import { NextResponse } from 'next/server'
import { validateTwilioSignature } from '@/lib/twilio/client'
import {
  findLatestPendingForPhone,
  parseVoteFromSmsBody,
  recordVote,
} from '@/lib/twilio/votes'
import { loadWorkspaceTwilio } from '@/lib/twilio/workspace-config'

/**
 * Inbound Twilio SMS webhook.
 * Reply Y / S / N (or open/snooze/ack) against the latest pending alert for that phone.
 * Configure Twilio console → Messaging webhook:
 *   https://bevel.<workspace>.lvh.me/api/twilio/webhook?tenant=<slug>
 */
export async function POST(request: Request) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  form.forEach((value, key) => {
    params[key] = String(value)
  })

  const from = params.From ?? ''
  const body = params.Body ?? ''
  const tenantHint =
    request.headers.get('x-bevel-tenant') ||
    new URL(request.url).searchParams.get('tenant') ||
    ''

  if (tenantHint) {
    const ws = loadWorkspaceTwilio(tenantHint)
    if (ws?.authToken) {
      const signature = request.headers.get('x-twilio-signature') ?? ''
      if (signature) {
        const url =
          ws.webhookBaseUrl
            ? `${ws.webhookBaseUrl.replace(/\/$/, '')}/api/twilio/webhook?tenant=${encodeURIComponent(tenantHint)}`
            : request.url
        const ok = await validateTwilioSignature({
          authToken: ws.authToken,
          signature,
          url,
          params,
        })
        if (!ok) {
          return twiml('Invalid signature.', 403)
        }
      }
    }
  }

  const vote = parseVoteFromSmsBody(body)
  // eslint-disable-next-line no-console
  console.log(`[bevel:twilio:inbound] ${from}: ${body} → ${vote ?? 'unknown'}`)

  if (!vote) {
    return twiml(
      'BEVEL: reply Y (open), S (snooze), or N (ack). Or use the links in the alert SMS.',
    )
  }

  const pending = findLatestPendingForPhone(from)
  if (!pending) {
    return twiml('No open BEVEL alert for this number. You’re all clear.')
  }

  recordVote(pending.token, vote)
  const copy =
    vote === 'open'
      ? 'Got it — open BEVEL when you can.'
      : vote === 'snooze'
        ? 'Snoozed. We will hold SMS for a bit.'
        : 'Acknowledged. Thanks.'

  return twiml(`BEVEL: ${copy}`)
}

function twiml(message: string, status = 200) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`
  return new NextResponse(xml, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  })
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

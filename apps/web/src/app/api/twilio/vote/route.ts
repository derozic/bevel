import { NextResponse } from 'next/server'
import { getPendingAlert, recordVote, type SmsVoteKind } from '@/lib/twilio/votes'

const VOTE_MAP: Record<string, SmsVoteKind> = {
  open: 'open',
  up: 'open',
  yes: 'open',
  y: 'open',
  snooze: 'snooze',
  s: 'snooze',
  later: 'snooze',
  ack: 'ack',
  down: 'ack',
  no: 'ack',
  n: 'ack',
  dismiss: 'ack',
}

/**
 * JOHNNY-style vote sink for SMS links.
 * GET /api/twilio/vote?token=…&v=open|snooze|ack
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') ?? ''
  const raw = (url.searchParams.get('v') ?? '').toLowerCase()
  const vote = VOTE_MAP[raw]

  if (!token || !vote) {
    return htmlPage(
      'Invalid vote link',
      'This link is missing a token or vote. Open BEVEL from the app instead.',
      400,
    )
  }

  const existing = getPendingAlert(token)
  if (!existing) {
    return htmlPage(
      'Link expired',
      'This presence alert expired or was already cleaned up. Open BEVEL to catch up.',
      410,
    )
  }

  const recorded = recordVote(token, vote)
  const labels: Record<SmsVoteKind, string> = {
    open: 'Opening BEVEL — thanks for checking in.',
    snooze: 'Snoozed. We will not re-SMS this alert for a while.',
    ack: 'Acknowledged. You’re covered without opening the app.',
  }

  const redirectPath =
    vote === 'open' ? `/^${recorded?.channelSlug || 'general'}` : null

  if (redirectPath) {
    // Soft page then client redirect so SMS browsers always show confirmation
    return htmlPage(
      'Opening BEVEL',
      labels.open,
      200,
      redirectPath,
    )
  }

  return htmlPage('Vote recorded', labels[vote], 200)
}

function htmlPage(
  title: string,
  body: string,
  status: number,
  redirectTo?: string | null,
) {
  const redirect = redirectTo
    ? `<meta http-equiv="refresh" content="1;url=${redirectTo}" />
<script>setTimeout(function(){location.href=${JSON.stringify(redirectTo)}},400)</script>`
    : ''
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · BEVEL</title>
  ${redirect}
  <style>
    body{font-family:system-ui,sans-serif;background:#0c0c0e;color:#f4f4f5;
      display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{max-width:22rem;padding:1.5rem 1.75rem;border-radius:1rem;
      border:1px solid #2a2a30;background:#141418}
    h1{font-size:1.15rem;margin:0 0 .5rem}
    p{margin:0;color:#a1a1aa;font-size:.9rem;line-height:1.45}
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
  </div>
</body>
</html>`
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

import { NextResponse } from 'next/server'
import { auth } from '@/auth'

/**
 * After system-browser Google OAuth, native clients land here (or are
 * redirected) and bounce into the app with identity query params:
 *
 *   bevel://auth/complete?email=…&name=…
 *
 * This avoids trusting spoofable identity headers on the public API from
 * unauthenticated mobile callers without a session cookie.
 */
export async function GET(request: Request) {
  const session = await auth()
  const url = new URL(request.url)
  const fallback =
    url.searchParams.get('fallback') ||
    'https://bevel.2x4m.cc/~general'

  if (!session?.user?.email) {
    return NextResponse.redirect(
      new URL(`/login?native=1&return=${encodeURIComponent('bevel://auth/complete')}`, url.origin),
    )
  }

  const params = new URLSearchParams()
  params.set('email', session.user.email)
  if (session.user.name) params.set('name', session.user.name)
  const id = (session.user as { id?: string }).id
  if (id) params.set('userId', id)
  const path = url.searchParams.get('path') || '/'
  params.set('path', path)

  const deep = `bevel://auth/complete?${params.toString()}`
  // HTML hop so universal links / custom schemes work across platforms
  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta http-equiv="refresh" content="0;url=${deep.replace(/"/g, '')}"/>
<title>Returning to BEVEL…</title>
</head><body style="font-family:system-ui;background:#0a0e12;color:#e2e8f0;padding:2rem">
<p>Returning to the BEVEL app…</p>
<p><a href="${deep.replace(/"/g, '&quot;')}" style="color:#22c55e">Open BEVEL</a></p>
<p style="color:#64748b;font-size:12px">If nothing happens, <a href="${fallback}" style="color:#94a3b8">continue in browser</a>.</p>
<script>location.replace(${JSON.stringify(deep)})</script>
</body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

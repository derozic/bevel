import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { issueAuthHandoffCode } from '@/lib/auth-handoff'

/**
 * After system-browser Google OAuth, native clients land here and bounce into
 * the app with identity + a one-time handoff code:
 *
 *   bevel://auth/complete?email=…&name=…&code=<handoff>&path=/~general
 *
 * The Flutter WebView redeems `code` on the workspace host
 * (`/api/auth/handoff`) so Auth.js cookies land in the **WebView cookie jar**
 * (Safari cookies are never shared with WKWebView).
 */
export async function GET(request: Request) {
  const session = await auth()
  const url = new URL(request.url)
  const fallback =
    url.searchParams.get('fallback') ||
    process.env.BEVEL_NATIVE_WORKSPACE_URL ||
    'https://bevel.2x4m.cc/~general'

  if (!session?.user?.email) {
    return NextResponse.redirect(
      new URL(
        `/login?native=1&return=${encodeURIComponent('bevel://auth/complete')}`,
        url.origin,
      ),
    )
  }

  const rawPath = url.searchParams.get('path') || '/~general'
  const path =
    rawPath.startsWith('/') && !rawPath.startsWith('//') ? rawPath : '/~general'
  const tenantSlug = (
    url.searchParams.get('tenant') ||
    process.env.BEVEL_DEFAULT_TENANT_SLUG ||
    '2x4m'
  )
    .trim()
    .toLowerCase()

  const params = new URLSearchParams()
  params.set('email', session.user.email)
  if (session.user.name) params.set('name', session.user.name)
  const id = (session.user as { id?: string }).id
  if (id) params.set('userId', id)
  params.set('path', path)
  params.set('tenant', tenantSlug)

  // Mint cross-host handoff so the native WebView can establish a host-local
  // session on bevel.2x4m.cc without sharing Safari cookies.
  const issued = await issueAuthHandoffCode({
    email: session.user.email,
    name: session.user.name,
    imageUrl: session.user.image,
    tenantSlug,
    callbackPath: path,
  })
  if (issued?.code) {
    params.set('code', issued.code)
    if (issued.expiresAt) params.set('expiresAt', issued.expiresAt)
  } else {
    console.error(
      '[auth/native-complete] handoff issue failed — WebView may show login wall',
    )
  }

  // Optional workspace origin hint for multi-tenant native builds
  try {
    const fb = new URL(fallback)
    if (fb.host) params.set('workspaceHost', fb.host)
  } catch {
    /* ignore */
  }

  const deep = `bevel://auth/complete?${params.toString()}`
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

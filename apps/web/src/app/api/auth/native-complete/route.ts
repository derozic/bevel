import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { issueAuthHandoffCode } from '@/lib/auth-handoff'
import { clearNativeLogin } from '@/lib/auth-native'

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
function requestPublicOrigin(request: Request): string {
  const url = new URL(request.url)
  const xfHost = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
  const host = (xfHost || url.hostname).split(':')[0] || url.hostname
  const loopback =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1'
  const xfProto = (
    request.headers.get('x-forwarded-proto') ??
    (url.protocol === 'https:' ? 'https' : 'http')
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
  const proto = xfProto === 'http' || xfProto === 'https' ? xfProto : 'https'
  if (!loopback) return `${proto}://${host}`
  return process.env.BEVEL_PUBLIC_URL || process.env.AUTH_URL || 'https://bevel.2x4m.lvh.me'
}

export async function GET(request: Request) {
  const session = await auth()
  const url = new URL(request.url)
  const origin = requestPublicOrigin(request)
  const fallback =
    url.searchParams.get('fallback') ||
    process.env.BEVEL_NATIVE_WORKSPACE_URL ||
    'https://bevel.2x4m.cc/~general'

  if (!session?.user?.email) {
    return NextResponse.redirect(
      new URL(
        `/login?native=1&return=${encodeURIComponent('bevel://auth/complete')}`,
        origin,
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

  await clearNativeLogin()

  const deep = `bevel://auth/complete?${params.toString()}`
  const safeDeep = deep.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Returning to BEVEL</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f4f0e8;color:#1c1917;margin:0;min-height:100vh;display:grid;place-items:center}
  .card{width:min(420px,92vw);padding:2rem 1.75rem;border:1px solid #e7e0d6;border-radius:1.25rem;background:#fffdf8;text-align:center}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{margin:0 0 1rem;color:#6b635b;line-height:1.45;font-size:.95rem}
  a.btn{display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem;padding:0 1.25rem;border-radius:999px;background:#1c1917;color:#f4f0e8;text-decoration:none;font-weight:600}
  .quiet{margin-top:1rem;font-size:.75rem;color:#8a8278}
</style>
</head><body>
<div class="card">
  <h1>Open the BEVEL app</h1>
  <p>Sign-in finished. Return to the desktop app to plant this session.</p>
  <a class="btn" id="open" href="${safeDeep}">Open BEVEL</a>
  <p class="quiet">If the app does not come forward, click the button. Stay here — do not continue in the browser.</p>
</div>
<script>
  const dest = ${JSON.stringify(deep)};
  const go = () => { window.location.href = dest; };
  go();
  setTimeout(go, 400);
  setTimeout(go, 1200);
</script>
</body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

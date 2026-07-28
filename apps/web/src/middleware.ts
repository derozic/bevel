import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { withTenantResolution } from '@bevel/tenant-config/middleware'

const PUBLIC_PATHS = [
  '/api/health',
  '/api/auth',
  '/api/auth/otp',
  '/api/auth/handoff',
  '/api/claim',
  '/api/agent-programs',
  '/api/github/webhook',
  '/api/github/agent-activity',
  // Twilio SMS (inbound webhook + JOHNNY-style vote links from the phone)
  '/api/twilio/webhook',
  '/api/twilio/vote',
  // BlueBubbles iMessage — auth enforced in route (fleet key / fail-closed prod)
  '/api/imessage',
  // Slack: OAuth callback (state cookie) + Events (HMAC in route)
  '/api/integrations/slack/oauth/callback',
  '/api/integrations/slack/events',
  '/brand',
  '/sw.js',
  '/manifest.webmanifest',
  '/icons',
  '/login',
  '/welcome',
  '/workspaces',
  '/claim',
  '/onboarding',
  '/about',
  '/story',
  '/privacy',
  '/terms',
  '/security',
  '/download',
  '/status',
  '/console',
  '/_next',
  '/favicon.ico',
]

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().split(':')[0] || ''
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.localhost')
  )
}

/**
 * Public origin for browser redirects.
 *
 * Behind Caddy, Next listens on http://127.0.0.1:41009. `request.nextUrl` can
 * become `https://localhost:41009` (X-Forwarded-Proto + bind host), which must
 * never appear in Location headers or browsers leave bevel.is.
 */
function publicOrigin(request: NextRequest): string {
  const xfHost = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
  const envPublic =
    process.env.BEVEL_PUBLIC_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    ''

  let host = xfHost && !isLoopbackHost(xfHost) ? xfHost.split(':')[0]! : ''
  if (!host && envPublic) {
    try {
      const u = new URL(envPublic)
      if (!isLoopbackHost(u.hostname)) host = u.hostname
    } catch {
      /* ignore */
    }
  }
  if (!host) {
    const fallback = request.nextUrl.hostname
    host = isLoopbackHost(fallback) ? 'bevel.is' : fallback
  }

  const xfProto = (
    request.headers.get('x-forwarded-proto') ??
    (request.nextUrl.protocol === 'https:' ? 'https' : 'http')
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
  const proto =
    xfProto === 'http' || xfProto === 'https'
      ? xfProto
      : envPublic.startsWith('https')
        ? 'https'
        : 'https'

  return `${proto}://${host}`
}

/** Absolute public URL for 3xx Location headers. */
function publicUrl(request: NextRequest, pathname: string): URL {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return new URL(`${path}${request.nextUrl.search}`, publicOrigin(request))
}

/**
 * Internal rewrite target. Must keep the *same origin as request.url*
 * (http://127.0.0.1:41009) so Next treats it as an in-process rewrite.
 *
 * Using nextUrl (https://localhost:41009/...) makes Next attempt an external
 * HTTPS proxy to itself → EPROTO "wrong version number" → 500 Internal Server Error.
 */
function internalRewriteUrl(request: NextRequest, pathname: string): URL {
  const url = new URL(request.url)
  url.pathname = pathname
  url.search = request.nextUrl.search
  return url
}

function requestHost(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host
  )
    .toLowerCase()
    .split(',')[0]!
    .trim()
    .split(':')[0]!
}

/**
 * Expire Domain-scoped OAuth check cookies left by older deploys.
 * Host-only + Domain=.bevel.is cookies share a name; browsers may send both and
 * Auth.js can parse the stale Domain one → InvalidCheck pkceCodeVerifier.
 */
function expireStaleDomainOAuthCookies(response: NextResponse): void {
  const domain =
    process.env.AUTH_COOKIE_DOMAIN || process.env.NEXTAUTH_COOKIE_DOMAIN
  if (!domain) return
  const names = [
    '__Secure-authjs.pkce.code_verifier',
    '__Secure-authjs.state',
    '__Secure-authjs.nonce',
    'authjs.pkce.code_verifier',
    'authjs.state',
    'authjs.nonce',
  ]
  for (const name of names) {
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: name.startsWith('__Secure-') || name.startsWith('__Host-'),
      sameSite: 'lax',
      domain,
    })
  }
}

/**
 * Public short paths:
 *   /^general          → rewrite → /bevel/general
 *   /talk/brain        → rewrite → /bevel/talk/brain
 *   /session/:id       → rewrite → /bevel/session/:id
 *
 * Legacy:
 *   /bevel/general     → 308 redirect → /^general
 *   /bevel/talk/*      → 308 → /talk/*
 *   /bevel/session/*   → 308 → /session/*
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Drop stale Domain-scoped PKCE/state cookies on every auth touch.
  if (pathname.startsWith('/api/auth')) {
    const res = NextResponse.next()
    expireStaleDomainOAuthCookies(res)
    return res
  }

  // ── Canonicalize legacy /bevel/* → short public URLs ─────────────────
  if (pathname === '/bevel' || pathname === '/bevel/') {
    return NextResponse.redirect(publicUrl(request, '/^general'), 308)
  }

  if (pathname.startsWith('/bevel/')) {
    const rest = pathname.slice('/bevel/'.length)

    if (rest.startsWith('talk/')) {
      return NextResponse.redirect(publicUrl(request, `/${rest}`), 308)
    }
    if (rest.startsWith('session/')) {
      return NextResponse.redirect(publicUrl(request, `/${rest}`), 308)
    }
    if (rest.startsWith('c/')) {
      const slug = rest.slice(2).split('/')[0] || 'general'
      return NextResponse.redirect(
        publicUrl(request, `/^${slug.toLowerCase()}`),
        308,
      )
    }
    // /bevel/general → /^general
    const slug = rest.split('/')[0]
    if (slug && !slug.includes('.')) {
      return NextResponse.redirect(
        publicUrl(request, `/^${slug.toLowerCase()}`),
        308,
      )
    }
  }

  // ── Rewrite short public paths → internal /bevel/* app routes ────────
  let rewritePath: string | null = null

  // /^general or /%5Egeneral
  const caretMatch = pathname.match(/^\/(?:\^|%5[eE])([a-z0-9][a-z0-9-]*)$/i)
  if (caretMatch) {
    rewritePath = `/bevel/${caretMatch[1]!.toLowerCase()}`
  }

  // /talk/:agentId
  if (!rewritePath) {
    const talkMatch = pathname.match(/^\/talk(?:\/([^/]+))?\/?$/)
    if (talkMatch) {
      rewritePath = talkMatch[1]
        ? `/bevel/talk/${talkMatch[1]}`
        : '/bevel/talk'
    }
  }

  // /session/:id
  if (!rewritePath) {
    const sessionMatch = pathname.match(/^\/session\/([^/]+)\/?$/)
    if (sessionMatch) {
      rewritePath = `/bevel/session/${sessionMatch[1]}`
    }
  }

  // /sessions archive (keep as-is or map later)
  if (!rewritePath && pathname === '/sessions') {
    // Realtime archive lives at /sessions on web if we add a page; leave next()
  }

  if (rewritePath) {
    const host = requestHost(request)
    const headers = new Headers(request.headers)
    headers.set('x-bevel-host', host)
    return NextResponse.rewrite(internalRewriteUrl(request, rewritePath), {
      request: { headers },
    })
  }

  return withTenantResolution(request, {
    publicPaths: PUBLIC_PATHS,
    unknownTenantUrl: process.env.BEVEL_UNKNOWN_TENANT_URL,
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

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
 * never appear in Location headers.
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
 * Middleware responsibilities:
 * - Expire stale Domain-scoped PKCE cookies on /api/auth/*
 * - Canonicalize legacy /bevel/* → short public URLs (redirect only)
 * - Normalize rare decoded `/^slug` → encoded `/%5Eslug` so next.config rewrites hit
 * - Stamp tenant host for non-public paths
 *
 * Short-path → /bevel/* **rewrites live in next.config.ts** (no self-proxy).
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
    return NextResponse.redirect(publicUrl(request, '/%5Egeneral'), 308)
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
        publicUrl(request, `/%5E${slug.toLowerCase()}`),
        308,
      )
    }
    // /bevel/general → /%5Egeneral (encoded so next.config rewrite matches)
    const slug = rest.split('/')[0]
    if (slug && !slug.includes('.')) {
      return NextResponse.redirect(
        publicUrl(request, `/%5E${slug.toLowerCase()}`),
        308,
      )
    }
  }

  // Rare: browser sends decoded caret path. Normalize to %5E so next.config
  // rewrite applies (path-to-regexp sources use the encoded form).
  const decodedCaret = pathname.match(/^\/\^([a-z0-9][a-z0-9-]*)$/i)
  if (decodedCaret) {
    return NextResponse.redirect(
      publicUrl(request, `/%5E${decodedCaret[1]!.toLowerCase()}`),
      308,
    )
  }

  return withTenantResolution(request, {
    publicPaths: PUBLIC_PATHS,
    unknownTenantUrl: process.env.BEVEL_UNKNOWN_TENANT_URL,
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

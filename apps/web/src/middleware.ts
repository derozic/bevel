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
 * Behind Caddy, nextUrl can become https://localhost:PORT — never use that
 * in Location headers.
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

/**
 * Redirect to public channel path: https://host/~general
 * Preserves query string (msg, q, agents).
 */
function channelTildeRedirect(request: NextRequest, slug: string): NextResponse {
  const clean = slug.trim().toLowerCase() || 'general'
  const qs = request.nextUrl.search
  const target = `${publicOrigin(request)}/~${clean}${qs}`
  return NextResponse.redirect(target, 308)
}

/**
 * Expire Domain-scoped OAuth check cookies left by older deploys.
 * Only legacy (pre-.v2) names — never Set-Cookie the active .v2 names here,
 * or browsers can dual-store Domain + host-only and break PKCE parse.
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
 * When AUTH_URL pins OAuth to one host, never start Google/GitHub sign-in on
 * another host (PKCE / CSRF cookies must be set on the callback host).
 *
 * - Google (primary login): hop to platform /login so the form can re-POST.
 * - GitHub (work-mode link while already signed in): hop to the same sign-in
 *   path on the pin host with callback preserved (default ~product).
 */
function redirectOAuthStartToPinnedHost(
  request: NextRequest,
): NextResponse | null {
  const match = request.nextUrl.pathname.match(
    /^\/api\/auth\/signin\/(google|github)\/?$/,
  )
  if (!match) return null
  const provider = match[1]!
  const raw = process.env.AUTH_URL || process.env.NEXTAUTH_URL
  if (!raw) return null
  let pinned: URL
  try {
    pinned = new URL(raw)
  } catch {
    return null
  }
  const reqHost = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    ''
  )
    .toLowerCase()
    .split(':')[0]
  if (!reqHost || reqHost === pinned.hostname.toLowerCase()) return null

  const cb =
    request.nextUrl.searchParams.get('callbackUrl') ||
    (provider === 'github' ? '/~product?github=linked' : '/welcome')

  if (provider === 'github') {
    // Account-link: land on pin host sign-in (GET) so cookies match callback host.
    const target = new URL(`/api/auth/signin/github`, pinned.origin)
    target.searchParams.set('callbackUrl', cb)
    return NextResponse.redirect(target, 303)
  }

  // Google primary: full page login on pin host (form POST after hop).
  const login = new URL('/login', pinned.origin)
  login.searchParams.set('callbackUrl', cb)
  return NextResponse.redirect(login, 303)
}

/**
 * Middleware:
 * - Force OAuth start onto AUTH_URL host when pinned
 * - Expire legacy Domain-scoped PKCE cookies on /api/auth/*
 * - Canonicalize legacy channel paths → /~slug (tilde, never encoded)
 * - Keep /talk and /session as path routes (next.config rewrites)
 * - Stamp tenant host
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/auth')) {
    const oauthHop = redirectOAuthStartToPinnedHost(request)
    if (oauthHop) return oauthHop
    const res = NextResponse.next()
    expireStaleDomainOAuthCookies(res)
    return res
  }

  // Legacy caret paths: /^general or /%5Egeneral → /~general
  const caretMatch = pathname.match(/^\/(?:\^|%5[eE])([a-z0-9][a-z0-9-]*)$/i)
  if (caretMatch) {
    return channelTildeRedirect(request, caretMatch[1]!)
  }

  // Encoded tilde (rare): /%7Egeneral → /~general
  const encodedTilde = pathname.match(/^\/%7[eE]([a-z0-9][a-z0-9-]*)$/i)
  if (encodedTilde) {
    return channelTildeRedirect(request, encodedTilde[1]!)
  }

  // /bevel → /~general
  if (pathname === '/bevel' || pathname === '/bevel/') {
    return channelTildeRedirect(request, 'general')
  }

  if (pathname.startsWith('/bevel/')) {
    const rest = pathname.slice('/bevel/'.length)

    // Keep talk + session as real path routes (not channels)
    if (rest.startsWith('talk/') || rest === 'talk') {
      if (rest.startsWith('talk/')) {
        const url = new URL(
          `/${rest}${request.nextUrl.search}`,
          publicOrigin(request),
        )
        return NextResponse.redirect(url, 308)
      }
      const url = new URL(`/talk${request.nextUrl.search}`, publicOrigin(request))
      return NextResponse.redirect(url, 308)
    }
    if (rest.startsWith('session/')) {
      const url = new URL(
        `/${rest}${request.nextUrl.search}`,
        publicOrigin(request),
      )
      return NextResponse.redirect(url, 308)
    }
    if (rest.startsWith('c/')) {
      const slug = rest.slice(2).split('/')[0] || 'general'
      return channelTildeRedirect(request, slug)
    }
    // /bevel/general → /~general
    const slug = rest.split('/')[0]
    if (slug && !slug.includes('.')) {
      return channelTildeRedirect(request, slug)
    }
  }

  return withTenantResolution(request, {
    publicPaths: PUBLIC_PATHS,
    unknownTenantUrl: process.env.BEVEL_UNKNOWN_TENANT_URL,
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

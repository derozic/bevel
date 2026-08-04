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
  '/account',
  '/me',
  '/auth/cli',
  '/claim',
  '/onboarding',
  '/about',
  '/story',
  '/privacy',
  '/terms',
  '/cookies',
  '/ccpa',
  '/dpa',
  '/subprocessors',
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
 * Middleware:
 * - Expire stale Domain-scoped PKCE cookies on /api/auth/*
 * - Canonicalize legacy channel paths → /~slug (tilde, never encoded)
 * - Keep /talk and /session as path routes (next.config rewrites)
 * - Stamp tenant host
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/auth')) {
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

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { withTenantResolution } from '@bevel/tenant-config/middleware'
import {
  NATIVE_COMPLETE_PATH,
  NATIVE_LOGIN_COOKIE,
  NATIVE_RETURNED_COOKIE,
  shouldInterceptNativeBrowserPath,
} from '@/lib/auth-native-shared'

const PUBLIC_PATHS = [
  '/api/health',
  '/api/auth',
  '/api/auth/otp',
  '/api/auth/handoff',
  '/api/claim',
  '/api/agent-programs',
  '/api/github/webhook',
  '/api/webhooks/inbound',
  '/api/ingest',
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
  '/security',
  '/download',
  '/status',
  '/api/status',
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

/** Cookie domains to clear (host-only + parent registrable domains). */
function cookieDomainCandidates(request: NextRequest): (string | undefined)[] {
  const host = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .split(':')[0]
  const out: (string | undefined)[] = [undefined]
  if (host?.endsWith('.2x4m.cc') || host === '2x4m.cc') out.push('.2x4m.cc')
  if (host?.endsWith('.bevel.is') || host === 'bevel.is') out.push('.bevel.is')
  const envDomain =
    process.env.AUTH_COOKIE_DOMAIN || process.env.NEXTAUTH_COOKIE_DOMAIN
  if (envDomain && !out.includes(envDomain)) out.push(envDomain)
  return out
}

function expireCookie(
  response: NextResponse,
  name: string,
  domain: string | undefined,
): void {
  response.cookies.set(name, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: name.startsWith('__Secure-') || name.startsWith('__Host-'),
    sameSite: 'lax',
    ...(domain ? { domain } : {}),
  })
}

/**
 * Expire Domain-scoped OAuth check cookies left by older deploys.
 */
function expireStaleDomainOAuthCookies(
  response: NextResponse,
  request: NextRequest,
): void {
  const names = [
    '__Secure-authjs.pkce.code_verifier',
    '__Secure-authjs.state',
    '__Secure-authjs.nonce',
    'authjs.pkce.code_verifier',
    'authjs.state',
    'authjs.nonce',
    '__Secure-authjs.state.v2',
    '__Secure-authjs.nonce.v2',
    'authjs.state.v2',
    'authjs.nonce.v2',
  ]
  for (const domain of cookieDomainCandidates(request)) {
    for (const name of names) {
      expireCookie(response, name, domain)
    }
  }
}

/**
 * Blow away session tokens (corrupt JWE / secret rotation). Call on /login?clear=1
 * or auth errors so users escape ERR_TOO_MANY_REDIRECTS without manual cookie UI.
 */
function expireSessionCookies(
  response: NextResponse,
  request: NextRequest,
): void {
  const names = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.session-token.0',
    'authjs.session-token.1',
    '__Secure-authjs.session-token.0',
    '__Secure-authjs.session-token.1',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.session-token.0',
    'next-auth.session-token.1',
    '__Secure-next-auth.session-token.0',
    '__Secure-next-auth.session-token.1',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'authjs.csrf-token',
    '__Host-authjs.csrf-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
  ]
  for (const domain of cookieDomainCandidates(request)) {
    for (const name of names) {
      expireCookie(response, name, domain)
    }
  }
  expireStaleDomainOAuthCookies(response, request)
}

/** App routes under /bevel/* that must NOT be treated as channel slugs. */
const BEVEL_RESERVED_SEGMENTS = new Set([
  'me',
  'talk',
  'session',
  'timeline',
  'tags',
  'c',
])

/**
 * Middleware:
 * - Expire stale Domain-scoped PKCE cookies on /api/auth/*
 * - Canonicalize legacy channel paths → /~slug (tilde, never encoded)
 * - Keep /talk and /session as path routes (next.config rewrites)
 * - Stamp tenant host
 */
/** Flutter/system-browser login must not dump the operator into /talk in Chrome. */
function isNativeLoginQuery(request: NextRequest): boolean {
  const q = request.nextUrl.searchParams
  const native = q.get('native')
  const cb = q.get('callbackUrl') ?? ''
  const ret = q.get('return') ?? ''
  return (
    native === '1' ||
    native === 'true' ||
    cb.includes('native-complete') ||
    ret.includes('native-complete') ||
    ret.startsWith('bevel://')
  )
}

function stampNativeLoginCookie(response: NextResponse): void {
  response.cookies.set(NATIVE_LOGIN_COOKIE, '1', {
    path: '/',
    maxAge: 15 * 60,
    sameSite: 'lax',
    httpOnly: true,
    secure: true,
  })
}

function shouldReturnToNativeApp(request: NextRequest): boolean {
  if (request.cookies.get(NATIVE_RETURNED_COOKIE)?.value === '1') return false
  if (request.cookies.get(NATIVE_LOGIN_COOKIE)?.value !== '1') return false
  const p = request.nextUrl.pathname
  if (p === NATIVE_COMPLETE_PATH || p.startsWith('/api/')) return false
  if (p === '/login' || p.startsWith('/login/')) return false
  if (p.startsWith('/_next')) return false
  return shouldInterceptNativeBrowserPath(p)
}

function requestHost(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .split(':')[0] || ''
}

function isStatusHost(host: string): boolean {
  return host === 'status.bevel.is' || host === 'status.bevel.lvh.me'
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  if (isStatusHost(requestHost(request)) && (pathname === '/' || pathname === '')) {
    const url = request.nextUrl.clone()
    url.pathname = '/status'
    return NextResponse.rewrite(url)
  }

  // Never expire PKCE/state on /api/auth/* — Next.js copies those Set-Cookie
  // deletes onto the same request, so the Google callback cannot read the
  // verifier and Auth.js fails with InvalidCheck (error=Configuration).
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  if (shouldReturnToNativeApp(request)) {
    return NextResponse.redirect(
      new URL(NATIVE_COMPLETE_PATH, publicOrigin(request)),
      302,
    )
  }

  // Escape hatch: clear corrupt session JWTs (Invalid Compact JWE) that cause
  // ERR_TOO_MANY_REDIRECTS when Auth.js partially decrypts old cookies.
  // Only on explicit ?clear=1 — wiping cookies on every ?error= hid the error
  // and bounced /login → /welcome → /login.
  const clearSession =
    searchParams.get('clear') === '1' || searchParams.get('clear') === 'session'
  if (pathname === '/login' && clearSession) {
    const res = withTenantResolution(request, {
      publicPaths: PUBLIC_PATHS,
      unknownTenantUrl: process.env.BEVEL_UNKNOWN_TENANT_URL,
    })
    expireSessionCookies(res, request)
    expireStaleDomainOAuthCookies(res, request)
    if (isNativeLoginQuery(request)) stampNativeLoginCookie(res)
    return res
  }
  if (clearSession) {
    // Never redirect via nextUrl (bind host is 127.0.0.1:41009 behind Caddy).
    const qs = new URLSearchParams(searchParams)
    qs.delete('clear')
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const target = `${publicOrigin(request)}${pathname}${suffix}`
    const res = NextResponse.redirect(target, 302)
    expireSessionCookies(res, request)
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
    // Private space / timeline are app routes, not channel slugs
    const first = rest.split('/')[0] || ''
    if (BEVEL_RESERVED_SEGMENTS.has(first.toLowerCase()) && first !== 'c') {
      return withTenantResolution(request, {
        publicPaths: PUBLIC_PATHS,
        unknownTenantUrl: process.env.BEVEL_UNKNOWN_TENANT_URL,
      })
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

  const res = withTenantResolution(request, {
    publicPaths: PUBLIC_PATHS,
    unknownTenantUrl: process.env.BEVEL_UNKNOWN_TENANT_URL,
  })
  if (pathname === '/login') {
    expireStaleDomainOAuthCookies(res, request)
    if (isNativeLoginQuery(request)) stampNativeLoginCookie(res)
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

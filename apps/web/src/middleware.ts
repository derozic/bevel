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
  '/_next',
  '/favicon.ico',
]

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
  const { pathname, search } = request.nextUrl

  // ── Canonicalize legacy /bevel/* → short public URLs ─────────────────
  if (pathname === '/bevel' || pathname === '/bevel/') {
    const url = request.nextUrl.clone()
    url.pathname = '/^general'
    return NextResponse.redirect(url, 308)
  }

  if (pathname.startsWith('/bevel/')) {
    const rest = pathname.slice('/bevel/'.length)
    const url = request.nextUrl.clone()

    if (rest.startsWith('talk/')) {
      url.pathname = `/${rest}`
      return NextResponse.redirect(url, 308)
    }
    if (rest.startsWith('session/')) {
      url.pathname = `/${rest}`
      return NextResponse.redirect(url, 308)
    }
    if (rest.startsWith('c/')) {
      const slug = rest.slice(2).split('/')[0] || 'general'
      url.pathname = `/^${slug.toLowerCase()}`
      return NextResponse.redirect(url, 308)
    }
    // /bevel/general → /^general
    const slug = rest.split('/')[0]
    if (slug && !slug.includes('.')) {
      url.pathname = `/^${slug.toLowerCase()}`
      return NextResponse.redirect(url, 308)
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
    const url = request.nextUrl.clone()
    url.pathname = rewritePath
    // Preserve query (msg, q, agents)
    const rewrite = NextResponse.rewrite(url)
    // Still stamp tenant host for the rewritten request
    const host = (
      request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      request.nextUrl.host
    )
      .toLowerCase()
      .split(':')[0]
    rewrite.headers.set('x-bevel-host', host)
    // Copy cookies etc. — withTenantResolution for non-rewrite path below
    const headers = new Headers(request.headers)
    headers.set('x-bevel-host', host)
    return NextResponse.rewrite(url, {
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

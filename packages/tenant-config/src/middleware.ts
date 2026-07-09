import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { PLATFORM_HOSTS, TENANT_HOST_HEADER } from './constants'

export type TenantMiddlewareOptions = {
  /** Paths that skip tenant resolution (e.g. /api/health) */
  publicPaths?: string[]
  /** Redirect unknown tenants to this URL (reserved for host allowlist) */
  unknownTenantUrl?: string
}

function normalizeHost(host: string): string {
  return host.toLowerCase().split(':')[0]
}

export function isPlatformHost(host: string): boolean {
  return PLATFORM_HOSTS.has(normalizeHost(host))
}

/**
 * Edge-safe tenant middleware.
 *
 * Only stamps the request host onto `x-bevel-host`. Full tenant config is loaded
 * in the Node server runtime via `getTenantFromRequest()` (fs + yaml).
 * Loading tenants here would pull `node:fs` into the Edge middleware bundle.
 */
export function withTenantResolution(
  request: NextRequest,
  options: TenantMiddlewareOptions = {},
): NextResponse {
  const { publicPaths = ['/api/health'] } = options
  const pathname = request.nextUrl.pathname

  if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const host = normalizeHost(
    request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      request.nextUrl.host,
  )

  if (isPlatformHost(host)) {
    return NextResponse.next()
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(TENANT_HOST_HEADER, host)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

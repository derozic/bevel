import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { TenantSchema } from '@bevel/schema'
import { isPlatformHost, lookupTenantByHost } from './registry'
import { TENANT_HEADER, TENANT_HOST_HEADER } from './server'

export type TenantMiddlewareOptions = {
  /** Paths that skip tenant resolution (e.g. /api/health) */
  publicPaths?: string[]
  /** Redirect unknown tenants to this URL */
  unknownTenantUrl?: string
}

function normalizeHost(host: string): string {
  return host.toLowerCase().split(':')[0]
}

export function resolveTenantFromRequest(request: NextRequest) {
  const host = normalizeHost(
    request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      request.nextUrl.host,
  )

  if (isPlatformHost(host)) {
    return { host, tenant: null, isPlatform: true }
  }

  const tenant = lookupTenantByHost(host)
  return { host, tenant, isPlatform: false }
}

export function withTenantResolution(
  request: NextRequest,
  options: TenantMiddlewareOptions = {},
): NextResponse {
  const { publicPaths = ['/api/health'], unknownTenantUrl } = options
  const pathname = request.nextUrl.pathname

  if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const { host, tenant, isPlatform } = resolveTenantFromRequest(request)

  if (isPlatform) {
    return NextResponse.next()
  }

  if (!tenant) {
    if (unknownTenantUrl) {
      return NextResponse.redirect(unknownTenantUrl)
    }
    return new NextResponse('Unknown tenant', { status: 404 })
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(TENANT_HOST_HEADER, host)
  requestHeaders.set(TENANT_HEADER, JSON.stringify(TenantSchema.parse(tenant)))

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}
import type { NextRequest } from 'next/server'
import { withTenantResolution } from '@bevel/tenant-config/middleware'

export function middleware(request: NextRequest) {
  return withTenantResolution(request, {
    publicPaths: ['/api/health', '/login', '/_next', '/favicon.ico'],
    unknownTenantUrl: process.env.BEVEL_UNKNOWN_TENANT_URL,
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
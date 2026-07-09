import type { NextRequest } from 'next/server'
import { withTenantResolution } from '@bevel/tenant-config/middleware'

export function middleware(request: NextRequest) {
  return withTenantResolution(request, {
    // Auth routes must resolve tenant from Host but stay unauthenticated.
    publicPaths: [
      '/api/health',
      '/api/auth',
      '/login',
      '/welcome',
      '/workspaces',
      '/_next',
      '/favicon.ico',
    ],
    unknownTenantUrl: process.env.BEVEL_UNKNOWN_TENANT_URL,
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
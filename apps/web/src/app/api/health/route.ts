import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const dynamic = 'force-dynamic'

/**
 * Lightweight liveness for load balancers and the public status page.
 * File-backed tenants (no SQLite); Postgres reserved for shared platform DB.
 */
export async function GET() {
  const started = Date.now()
  const tenantsRoot =
    process.env.BEVEL_TENANTS_ROOT?.trim() ||
    resolve(process.cwd(), '../../tenants')
  const tenantsWritable = (() => {
    try {
      // Readable root is enough for soft multi-tenant; claim needs write.
      return existsSync(tenantsRoot)
    } catch {
      return false
    }
  })()

  const body = {
    ok: true,
    service: 'bevel-web',
    version: process.env.NEXT_PUBLIC_GIT_SHA || process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    checks: {
      tenantsRoot,
      tenantsRootPresent: tenantsWritable,
      publicUrl: process.env.BEVEL_PUBLIC_URL || process.env.AUTH_URL || null,
      authConfigured: Boolean(
        process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      ),
    },
  }

  return Response.json(body, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

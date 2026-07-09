import { headers } from 'next/headers'
import { TenantSchema, type Tenant } from '@bevel/schema'
import { lookupTenantByHost, lookupTenantBySlug } from './registry'

export const TENANT_HEADER = 'x-bevel-tenant'
export const TENANT_HOST_HEADER = 'x-bevel-host'

function normalizeHost(host: string): string {
  return host.toLowerCase().split(':')[0]
}

export async function getTenantFromRequest(): Promise<Tenant | null> {
  const headerStore = await headers()
  const tenantJson = headerStore.get(TENANT_HEADER)
  if (tenantJson) {
    try {
      return TenantSchema.parse(JSON.parse(tenantJson))
    } catch {
      // fall through to host lookup
    }
  }

  const host =
    headerStore.get(TENANT_HOST_HEADER) ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host')

  if (!host) return null
  return lookupTenantByHost(normalizeHost(host))
}

export async function requireTenantFromRequest(): Promise<Tenant> {
  const tenant = await getTenantFromRequest()
  if (!tenant) {
    throw new Error('Tenant not resolved for this request')
  }
  return tenant
}

export function getTenantFromSlug(slug: string): Tenant | null {
  return lookupTenantBySlug(slug)
}
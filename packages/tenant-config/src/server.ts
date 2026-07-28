import { headers } from 'next/headers'
import { TenantSchema, type Tenant } from '@bevel/schema'
import {
  isPlatformEntryHost,
  TENANT_HEADER,
  TENANT_HOST_HEADER,
} from './constants'
import { platformEntryTenant } from './platform-entry'
import {
  isPlatformHost,
  lookupTenantByHost,
  lookupTenantBySlug,
} from './registry'

export { TENANT_HEADER, TENANT_HOST_HEADER }

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
  const normalized = normalizeHost(host)
  // Platform entry (bevel.is) ALWAYS wins over YAML host aliases so a customer
  // tenant can never paint 2x4m (or any org) chrome on the apex login.
  if (isPlatformEntryHost(normalized) || isPlatformHost(normalized)) {
    return platformEntryTenant(normalized)
  }
  return lookupTenantByHost(normalized)
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
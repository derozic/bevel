import type { Tenant } from '@bevel/schema'
import {
  listTenantSlugs,
  loadCompiledTenant,
  loadDeclarativeTenant,
  resolveTenantsRoot,
} from './loader'

const PLATFORM_HOSTS = new Set([
  'bevel.com',
  'www.bevel.com',
  'admin.bevel.com',
  'admin.bevel.lvh.me',
  'localhost',
])

function parseDevTenantOverrides(): Map<string, string> {
  const map = new Map<string, string>()
  const raw = process.env.BEVEL_DEV_TENANTS ?? ''
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [host, slug] = entry.split(':')
    if (host && slug) map.set(host.toLowerCase(), slug)
  }
  return map
}

function buildRegistry(): {
  byHost: Map<string, Tenant>
  bySlug: Map<string, Tenant>
} {
  const byHost = new Map<string, Tenant>()
  const bySlug = new Map<string, Tenant>()
  const root = resolveTenantsRoot()

  for (const slug of listTenantSlugs(root)) {
    try {
      const tenant = loadCompiledTenant(slug, root)
      const declarative = loadDeclarativeTenant(slug, root)
      bySlug.set(slug, tenant)
      byHost.set(tenant.host.toLowerCase(), tenant)
      for (const alias of declarative.hosts ?? []) {
        byHost.set(alias.toLowerCase().split(':')[0], tenant)
      }
    } catch (err) {
      console.warn(`[tenant-config] skip ${slug}:`, err)
    }
  }

  return { byHost, bySlug }
}

let cache: { byHost: Map<string, Tenant>; bySlug: Map<string, Tenant> } | null = null

function registry() {
  if (!cache) cache = buildRegistry()
  return cache
}

export function refreshTenantRegistry(): void {
  cache = buildRegistry()
}

export function isPlatformHost(host: string): boolean {
  const normalized = host.toLowerCase().split(':')[0]
  return PLATFORM_HOSTS.has(normalized)
}

export function lookupTenantByHost(host: string): Tenant | null {
  const normalized = host.toLowerCase().split(':')[0]
  const { byHost, bySlug } = registry()
  const overrideSlug = parseDevTenantOverrides().get(normalized)
  if (overrideSlug) {
    return bySlug.get(overrideSlug) ?? null
  }
  return byHost.get(normalized) ?? null
}

export function lookupTenantBySlug(slug: string): Tenant | null {
  return registry().bySlug.get(slug) ?? null
}

export function listTenants(): Tenant[] {
  return Array.from(registry().bySlug.values())
}
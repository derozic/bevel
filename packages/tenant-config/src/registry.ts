import type { Tenant } from '@bevel/schema'
import { PLATFORM_HOSTS, isPlatformEntryHost } from './constants'
import {
  listTenantSlugs,
  loadCompiledTenant,
  loadDeclarativeTenant,
  resolveTenantsRoot,
} from './loader'

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
  byEmailDomain: Map<string, Tenant[]>
} {
  const byHost = new Map<string, Tenant>()
  const bySlug = new Map<string, Tenant>()
  const byEmailDomain = new Map<string, Tenant[]>()
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

      const domains = new Set<string>([
        ...(tenant.auth.allowedEmailDomains ?? []).map((d) => d.toLowerCase()),
        ...(tenant.auth.defaultForDomains ?? []).map((d) => d.toLowerCase()),
      ])
      for (const domain of domains) {
        const list = byEmailDomain.get(domain) ?? []
        list.push(tenant)
        byEmailDomain.set(domain, list)
      }
    } catch (err) {
      console.warn(`[tenant-config] skip ${slug}:`, err)
    }
  }

  return { byHost, bySlug, byEmailDomain }
}

let cache: {
  byHost: Map<string, Tenant>
  bySlug: Map<string, Tenant>
  byEmailDomain: Map<string, Tenant[]>
} | null = null

function registry() {
  // Dev: always rebuild so bevel.yaml brand renames (e.g. product_name) show in UI.
  // Production: keep process-level cache until explicit refreshTenantRegistry().
  if (!cache || process.env.NODE_ENV !== 'production') {
    cache = buildRegistry()
  }
  return cache
}

export function refreshTenantRegistry(): void {
  cache = buildRegistry()
}

export function isPlatformHost(host: string): boolean {
  const normalized = host.toLowerCase().split(':')[0]
  return PLATFORM_HOSTS.has(normalized)
}

export { isPlatformEntryHost }

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

/** All tenants that allow this email domain (or list it as a routing default). */
export function lookupTenantsByEmailDomain(domain: string): Tenant[] {
  const key = domain.toLowerCase().trim()
  return [...(registry().byEmailDomain.get(key) ?? [])]
}

/**
 * Resolve home workspace(s) for a Google Workspace email.
 * - unique domain match → that tenant
 * - multi match with default_for_domains → preferred tenant first
 * - multi match otherwise → all candidates (caller shows picker)
 */
export function resolveWorkspacesForEmail(email: string): {
  domain: string
  tenants: Tenant[]
  preferred: Tenant | null
} {
  const normalized = email.toLowerCase().trim()
  const domain = normalized.split('@')[1] ?? ''
  if (!domain) return { domain: '', tenants: [], preferred: null }

  const tenants = lookupTenantsByEmailDomain(domain)
  if (tenants.length === 0) return { domain, tenants: [], preferred: null }

  // Exact email allowlist wins over domain
  const emailExact = listTenants().filter((t) =>
    t.auth.allowedEmails?.some((e) => e.toLowerCase() === normalized),
  )
  if (emailExact.length === 1) {
    return { domain, tenants: emailExact, preferred: emailExact[0]! }
  }

  const preferred =
    tenants.find((t) =>
      t.auth.defaultForDomains?.some((d) => d.toLowerCase() === domain),
    ) ?? (tenants.length === 1 ? tenants[0]! : null)

  return { domain, tenants, preferred }
}

/** Single home tenant for auto-route, or null if picker required / none. */
export function resolveHomeTenantForEmail(email: string): Tenant | null {
  const { preferred, tenants } = resolveWorkspacesForEmail(email)
  if (preferred) return preferred
  if (tenants.length === 1) return tenants[0]!
  return null
}

export function publicTenantUrl(tenant: Tenant, path = '/bevel'): string {
  const proto =
    process.env.BEVEL_PUBLIC_PROTOCOL ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'https')
  const base = `${proto}://${tenant.host}`
  if (!path.startsWith('/')) return `${base}/${path}`
  return `${base}${path}`
}

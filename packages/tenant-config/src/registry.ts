import type { Tenant } from '@bevel/schema'
import { PLATFORM_HOSTS, isPlatformEntryHost } from './constants'
import {
  listTenantSlugs,
  loadCompiledTenant,
  loadDeclarativeTenant,
  resolveTenantsRoot,
} from './loader'
import {
  emailIsMemberOfWorkspace as emailIsMemberOfWorkspaceFromFile,
  membershipSlugsForEmail,
} from './memberships'

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
 * Spaces a person can enter (product workspaces only — Private is always separate).
 *
 * Clean model:
 * - memberships.yaml is primary (person ↔ workspace + role)
 * - tenant allowed_emails still count (claim / closed gates)
 * - preferred is always null → apex always uses chooser
 */
export function resolveWorkspacesForEmail(email: string): {
  domain: string
  tenants: Tenant[]
  preferred: Tenant | null
} {
  const normalized = email.toLowerCase().trim()
  const domain = normalized.split('@')[1] ?? ''
  if (!normalized) return { domain: '', tenants: [], preferred: null }

  const bySlug = new Map<string, Tenant>()
  for (const slug of membershipSlugsForEmail(normalized)) {
    const t = lookupTenantBySlug(slug)
    if (t) bySlug.set(t.slug, t)
  }
  for (const t of listTenants()) {
    if (t.auth.allowedEmails?.some((e) => e.toLowerCase() === normalized)) {
      bySlug.set(t.slug, t)
    }
  }
  return {
    domain,
    tenants: [...bySlug.values()],
    preferred: null,
  }
}

/** Single membership only — never used for apex silent handoff. */
export function resolveHomeTenantForEmail(email: string): Tenant | null {
  const { tenants } = resolveWorkspacesForEmail(email)
  if (tenants.length === 1) return tenants[0]!
  return null
}

export function emailIsMemberOfWorkspace(
  email: string,
  workspaceSlug: string,
): boolean {
  if (emailIsMemberOfWorkspaceFromFile(email, workspaceSlug)) return true
  const slug = workspaceSlug.toLowerCase().trim()
  const t = lookupTenantBySlug(slug)
  if (!t) return false
  return Boolean(
    t.auth.allowedEmails?.some((e) => e.toLowerCase() === email.toLowerCase()),
  )
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.localhost')
  )
}

export function isPreviewHost(hostname: string): boolean {
  const h = hostname.toLowerCase().split(':')[0] || ''
  return h === 'lvh.me' || h.endsWith('.lvh.me')
}

function previewAliasFor(tenant: Tenant): string | undefined {
  const aliases = tenantHostnames(tenant)
  const preferred = tenant.slug ? `bevel.${tenant.slug}.lvh.me` : undefined
  if (preferred && aliases.includes(preferred)) return preferred
  return aliases.find((h) => isPreviewHost(h)) || preferred
}

function tenantHostnames(tenant: Tenant): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [tenant.host, ...(tenant.hosts ?? [])]) {
    const host = (raw || '').toLowerCase().split(':')[0]
    if (!host || seen.has(host)) continue
    seen.add(host)
    out.push(host)
  }
  return out
}

/**
 * Host to open for this workspace from the current request.
 * Local `.lvh.me` sessions stay on a preview alias so the picker never
 * hops to production (bevel.2ndbra.in) and dies on localhost:41009.
 */
function normalizeRequestHost(raw?: string): string {
  return (raw || '').split(',')[0]?.trim().toLowerCase().split(':')[0] || ''
}

function localDevPrefersPreview(): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const urls = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.BEVEL_PUBLIC_URL,
  ]
  return urls.some((u) => (u || '').includes('.lvh.me'))
}

export function tenantPublicHost(tenant: Tenant, fromHost?: string): string {
  const from = normalizeRequestHost(fromHost)
  const aliases = tenantHostnames(tenant)
  const canonical = (tenant.host || aliases[0] || '').toLowerCase().split(':')[0]

  if (from && aliases.includes(from)) return from

  const wantPreview =
    localDevPrefersPreview() ||
    isPreviewHost(from) ||
    isLoopbackHost(from)
  if (wantPreview) {
    const preview = previewAliasFor(tenant)
    if (preview) return preview
  }

  if (canonical && !isLoopbackHost(canonical)) return canonical

  const fromEnv =
    process.env.BEVEL_PUBLIC_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL
  if (fromEnv) {
    try {
      const u = new URL(fromEnv)
      if (!isLoopbackHost(u.hostname)) return u.hostname
    } catch {
      /* keep looking */
    }
  }
  return canonical || 'bevel.is'
}

/**
 * Absolute URL for an org workspace host.
 * Prefer a preview alias when `fromHost` is local; otherwise `tenant.host`
 * so platform entry does not rewrite org hops onto bevel.is.
 */
export function publicTenantUrl(
  tenant: Tenant,
  path = '/bevel',
  fromHost?: string,
): string {
  const proto =
    process.env.BEVEL_PUBLIC_PROTOCOL ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'https')

  const host = tenantPublicHost(tenant, fromHost)
  const base = `${proto}://${host}`
  if (!path.startsWith('/')) return `${base}/${path}`
  return `${base}${path}`
}

/** Registrable domain for cookie / handoff decisions (e.g. bevel.is vs 2x4m.cc). */
export function registrableDomain(hostname: string): string {
  const h = hostname.toLowerCase().split(':')[0] || ''
  const parts = h.split('.').filter(Boolean)
  if (parts.length <= 2) return h
  // Special multi-part public suffixes we care about
  const last2 = parts.slice(-2).join('.')
  if (last2 === 'lvh.me' || last2 === '2x4m.cc' || last2 === '2x4m.systems') {
    return last2
  }
  return last2
}

/** True when session cookies cannot be shared across these hosts. */
export function needsAuthHandoff(fromHost: string, toHost: string): boolean {
  const a = fromHost.toLowerCase().split(':')[0] || ''
  const b = toHost.toLowerCase().split(':')[0] || ''
  if (!a || !b || a === b) return false
  // Same parent (e.g. *.lvh.me / *.bevel.is) can share AUTH_COOKIE_DOMAIN
  if (registrableDomain(a) === registrableDomain(b)) return false
  return true
}

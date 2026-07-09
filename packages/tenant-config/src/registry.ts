import type { Tenant } from '@bevel/schema'

/** Seed tenants for local dev and platform defaults. Production loads from domains service / KV. */
const DEMO_TENANT: Tenant = {
  id: 'tenant_demo',
  slug: 'demo',
  name: 'BEVEL Demo',
  host: 'demo.bevel.lvh.me',
  status: 'active',
  auth: {
    providers: ['google', 'github'],
    allowedEmailDomains: ['derozic.com'],
    requireGitHubForWork: false,
  },
  features: {
    channels: true,
    directMessages: true,
    agentDispatch: true,
    workMode: true,
    customBranding: false,
  },
  theme: {
    accent: '#7c5cff',
    productName: 'BEVEL',
  },
  realtime: {
    namespace: 'demo',
    url: process.env.REALTIME_URL ?? 'https://realtime.bevel.lvh.me',
  },
  workRepos: ['derozic/bevel'],
}

const ACME_TENANT: Tenant = {
  id: 'tenant_acme',
  slug: 'acme',
  name: 'Acme Corp',
  host: 'bevel.acme.lvh.me',
  status: 'active',
  auth: {
    providers: ['google'],
    allowedEmailDomains: ['acme.com'],
    requireGitHubForWork: false,
  },
  features: {
    channels: true,
    directMessages: true,
    agentDispatch: true,
    workMode: false,
    customBranding: true,
  },
  theme: {
    accent: '#22c55e',
    productName: 'Acme Workspace',
  },
  realtime: {
    namespace: 'acme',
  },
  workRepos: [],
}

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

const TENANTS_BY_HOST = new Map<string, Tenant>([
  [DEMO_TENANT.host.toLowerCase(), DEMO_TENANT],
  [ACME_TENANT.host.toLowerCase(), ACME_TENANT],
])

const TENANTS_BY_SLUG = new Map<string, Tenant>([
  [DEMO_TENANT.slug, DEMO_TENANT],
  [ACME_TENANT.slug, ACME_TENANT],
])

export function isPlatformHost(host: string): boolean {
  const normalized = host.toLowerCase().split(':')[0]
  return PLATFORM_HOSTS.has(normalized)
}

export function lookupTenantByHost(host: string): Tenant | null {
  const normalized = host.toLowerCase().split(':')[0]
  const overrideSlug = parseDevTenantOverrides().get(normalized)
  if (overrideSlug) {
    return TENANTS_BY_SLUG.get(overrideSlug) ?? null
  }
  return TENANTS_BY_HOST.get(normalized) ?? null
}

export function lookupTenantBySlug(slug: string): Tenant | null {
  return TENANTS_BY_SLUG.get(slug) ?? null
}

export function listTenants(): Tenant[] {
  return Array.from(TENANTS_BY_SLUG.values())
}
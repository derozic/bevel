import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import { DeclarativeTenantSchema } from '@bevel/schema/declarative-tenant'
import type { Tenant } from '@bevel/schema'
import {
  listTenantSlugs,
  loadCompiledTenant,
  resolveTenantsRoot,
  tenantDir,
} from './loader'
import { lookupTenantBySlug, refreshTenantRegistry } from './registry'

/** Host segments that must never become customer tenant slugs. */
export const RESERVED_TENANT_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'bevel',
  'claim',
  'cname',
  'demo',
  'docs',
  'download',
  'login',
  'onboarding',
  'realtime',
  'settings',
  'signup',
  'status',
  'story',
  'about',
  'privacy',
  'terms',
  'security',
  'welcome',
  'workspaces',
  'www',
  'mail',
  'support',
  'help',
  'static',
  'assets',
])

export type ProvisionTenantInput = {
  /** Display name for the organization */
  name: string
  /** URL-safe slug (workspace namespace) */
  slug: string
  /** Google Workspace email domain, e.g. acme.com */
  emailDomain: string
  /** Claimant email — always allowlisted */
  ownerEmail: string
  /** Optional product label on the shell */
  productName?: string
  /** Accent color #RRGGBB */
  accent?: string
}

export type ProvisionTenantResult =
  | { ok: true; tenant: Tenant; host: string }
  | { ok: false; error: string; code: 'reserved' | 'taken' | 'invalid' | 'exists' }

export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48)
}

export function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) && slug.length >= 2 && slug.length <= 48
}

export function claimHostForSlug(slug: string): string {
  const base =
    process.env.BEVEL_CLAIM_HOST_SUFFIX?.replace(/^\./, '') ||
    (process.env.NODE_ENV === 'production' ? 'bevel.com' : 'bevel.lvh.me')
  return `${slug}.${base}`
}

/**
 * Create a new tenant on disk (bevel.yaml + theme.json) and refresh the registry.
 * Local multi-tenant: host is {slug}.bevel.lvh.me (add Caddy wildcard if needed).
 */
export function provisionTenant(input: ProvisionTenantInput): ProvisionTenantResult {
  const slug = input.slug.trim().toLowerCase()
  const name = input.name.trim()
  const emailDomain = input.emailDomain.trim().toLowerCase()
  const ownerEmail = input.ownerEmail.trim().toLowerCase()

  if (!name || name.length < 2) {
    return { ok: false, code: 'invalid', error: 'Organization name is required.' }
  }
  if (!isValidTenantSlug(slug)) {
    return {
      ok: false,
      code: 'invalid',
      error: 'Slug must be 2–48 characters: lowercase letters, numbers, hyphens.',
    }
  }
  if (RESERVED_TENANT_SLUGS.has(slug)) {
    return { ok: false, code: 'reserved', error: `“${slug}” is reserved. Choose another slug.` }
  }
  if (!emailDomain || !emailDomain.includes('.')) {
    return { ok: false, code: 'invalid', error: 'A valid email domain is required.' }
  }
  if (!ownerEmail.includes('@')) {
    return { ok: false, code: 'invalid', error: 'Owner email is required.' }
  }

  if (lookupTenantBySlug(slug) || listTenantSlugs().includes(slug)) {
    return { ok: false, code: 'taken', error: `Workspace “${slug}” is already taken.` }
  }

  const host = claimHostForSlug(slug)
  const accent = input.accent?.match(/^#[0-9a-fA-F]{6}$/)
    ? input.accent
    : '#7c5cff'
  const productName = input.productName?.trim() || name

  const declarative = DeclarativeTenantSchema.parse({
    tenant: slug,
    name,
    domain: host,
    hosts: [],
    brand: {
      theme: './theme.json',
      product_name: productName,
    },
    features: {
      async_streams: true,
      live_sessions: true,
      analytics: true,
      channels: true,
      direct_messages: true,
      agent_dispatch: true,
      work_mode: true,
      custom_branding: true,
      live_media: false,
    },
    auth: {
      mode: 'google',
      allowed_domains: [emailDomain],
      allowed_emails: [ownerEmail],
      default_for_domains: [emailDomain],
      require_github_for_work: false,
    },
    realtime: {
      namespace: slug,
      presence: true,
      url:
        process.env.NEXT_PUBLIC_REALTIME_URL ||
        process.env.REALTIME_URL ||
        'https://realtime.bevel.lvh.me',
    },
    work_repos: [],
  })

  const root = resolveTenantsRoot()
  const dir = tenantDir(slug, root)
  if (existsSync(join(dir, 'bevel.yaml'))) {
    return { ok: false, code: 'exists', error: `Tenant directory already exists for ${slug}.` }
  }

  mkdirSync(dir, { recursive: true })

  const yamlBody = stringifyYaml(declarative, {
    lineWidth: 0,
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  })
  writeFileSync(join(dir, 'bevel.yaml'), yamlBody, 'utf8')
  writeFileSync(
    join(dir, 'theme.json'),
    `${JSON.stringify(
      {
        accent,
        background: '#0c0c0e',
        surface: '#141418',
        text: '#f4f4f5',
        mode: 'dark',
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  refreshTenantRegistry()
  const tenant = loadCompiledTenant(slug, root)
  return { ok: true, tenant, host }
}

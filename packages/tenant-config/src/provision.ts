import {
  accessSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
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
  /**
   * Soft multi-tenant: bind domain to this host (e.g. bevel.2x4m.cc) instead of
   * creating slug.suffix until wildcard DNS exists.
   */
  softHost?: string
}

export type ProvisionTenantResult =
  | { ok: true; tenant: Tenant; host: string }
  | {
      ok: false
      error: string
      code: 'reserved' | 'taken' | 'invalid' | 'exists' | 'io' | 'config'
    }

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
  return (
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) &&
    slug.length >= 2 &&
    slug.length <= 48
  )
}

/** Whether claims should use soft multi-tenant (same public host, slug namespace). */
export function isSoftClaimMode(): boolean {
  const mode = (process.env.BEVEL_CLAIM_MODE || '').toLowerCase()
  if (mode === 'soft' || mode === '1' || mode === 'true') return true
  if (mode === 'dns' || mode === 'host' || mode === '0' || mode === 'false') {
    return false
  }
  // Default soft in production until wildcard DNS is standard
  return process.env.NODE_ENV === 'production'
}

/**
 * DNS suffix for dedicated claim hosts (`slug.{suffix}`).
 * Prefer BEVEL_CLAIM_HOST_SUFFIX; production default bevel.is (not legacy bevel.com).
 */
export function claimHostSuffix(): string {
  const fromEnv = process.env.BEVEL_CLAIM_HOST_SUFFIX?.replace(/^\./, '').trim()
  if (fromEnv) return fromEnv
  if (process.env.NODE_ENV === 'production') return 'bevel.is'
  return 'bevel.lvh.me'
}

export function claimHostForSlug(slug: string, softHost?: string): string {
  if (softHost && softHost.trim()) {
    return softHost.trim().toLowerCase().split(':')[0]!
  }
  if (isSoftClaimMode() && process.env.BEVEL_PUBLIC_URL) {
    try {
      return new URL(process.env.BEVEL_PUBLIC_URL).hostname
    } catch {
      /* fall through */
    }
  }
  if (isSoftClaimMode() && process.env.AUTH_URL) {
    try {
      return new URL(process.env.AUTH_URL).hostname
    } catch {
      /* fall through */
    }
  }
  return `${slug}.${claimHostSuffix()}`
}

/** Human-readable host preview for the claim UI. */
export function claimHostPreview(slug: string, softHost?: string): string {
  const s = slug || 'your-org'
  if (softHost || isSoftClaimMode()) {
    const host = claimHostForSlug(s, softHost)
    return `${host} (namespace: ${s})`
  }
  return claimHostForSlug(s)
}

/**
 * Ensure tenants root exists and is writable by this process.
 * Throws Error with `.code` set to io/config on failure.
 */
export function ensureTenantsRootWritable(root = resolveTenantsRoot()): string {
  try {
    if (!existsSync(root)) {
      mkdirSync(root, { recursive: true })
    }
    accessSync(root, fsConstants.W_OK)
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as NodeJS.ErrnoException).code)
        : 'UNKNOWN'
    const e = new Error(
      `Tenants root is not writable (${code}): ${root}. Set BEVEL_TENANTS_ROOT to a writable directory and ensure the process has write access (systemd ReadWritePaths).`,
    ) as Error & { code: string; path: string }
    e.code = code === 'EACCES' || code === 'EROFS' || code === 'EPERM' ? 'io' : 'config'
    e.path = root
    throw e
  }
  return root
}

export function tenantsRootWritableStatus(root = resolveTenantsRoot()): {
  tenantsRoot: string
  exists: boolean
  writable: boolean
  error?: string
} {
  try {
    ensureTenantsRootWritable(root)
    return { tenantsRoot: root, exists: true, writable: true }
  } catch (err) {
    return {
      tenantsRoot: root,
      exists: existsSync(root),
      writable: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Create a new tenant on disk (bevel.yaml + theme.json) and refresh the registry.
 * Soft multi-tenant: domain is the public host; slug is the realtime namespace.
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
    return {
      ok: false,
      code: 'reserved',
      error: `"${slug}" is reserved. Choose another slug.`,
    }
  }
  if (!emailDomain || !emailDomain.includes('.')) {
    return { ok: false, code: 'invalid', error: 'A valid email domain is required.' }
  }
  if (!ownerEmail.includes('@')) {
    return { ok: false, code: 'invalid', error: 'Owner email is required.' }
  }

  if (lookupTenantBySlug(slug) || listTenantSlugs().includes(slug)) {
    return {
      ok: false,
      code: 'taken',
      error: `Workspace "${slug}" is already taken.`,
    }
  }

  let root: string
  try {
    root = ensureTenantsRootWritable()
  } catch (err) {
    return {
      ok: false,
      code: 'io',
      error: err instanceof Error ? err.message : 'Tenants directory is not writable.',
    }
  }

  const host = claimHostForSlug(slug, input.softHost)
  const soft = isSoftClaimMode() || Boolean(input.softHost)
  const accent = input.accent?.match(/^#[0-9a-fA-F]{6}$/)
    ? input.accent
    : '#7c5cff'
  const productName = input.productName?.trim() || name

  const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    process.env.REALTIME_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://realtime.bevel.is'
      : 'https://realtime.bevel.lvh.me')

  let declarative
  try {
    declarative = DeclarativeTenantSchema.parse({
      tenant: slug,
      name,
      domain: host,
      // Soft multi-tenant: primary host is shared; slug is the namespace key
      hosts: soft && host !== `${slug}.${claimHostSuffix()}` ? [] : [],
      plan: 'trial',
      feature_access: 'stable',
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
        // Owner's domain prefers this workspace after platform login
        default_for_domains: [emailDomain],
        require_github_for_work: false,
      },
      realtime: {
        namespace: slug,
        presence: true,
        url: realtimeUrl,
      },
      work_repos: [],
      deployment: {
        target: 'custom',
        production_url: soft
          ? `https://${host}`
          : `https://${slug}.${claimHostSuffix()}`,
      },
    })
  } catch (err) {
    return {
      ok: false,
      code: 'invalid',
      error:
        err instanceof Error
          ? `Invalid tenant config: ${err.message}`
          : 'Invalid tenant config.',
    }
  }

  const dir = tenantDir(slug, root)
  if (existsSync(join(dir, 'bevel.yaml'))) {
    return {
      ok: false,
      code: 'exists',
      error: `Tenant directory already exists for ${slug}.`,
    }
  }

  try {
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
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as NodeJS.ErrnoException).code)
        : 'WRITE_FAILED'
    return {
      ok: false,
      code: 'io',
      error: `Failed to write tenant files (${code}) under ${dir}. Check BEVEL_TENANTS_ROOT and process write permissions.`,
    }
  }

  try {
    refreshTenantRegistry()
    const tenant = loadCompiledTenant(slug, root)
    return { ok: true, tenant, host }
  } catch (err) {
    return {
      ok: false,
      code: 'config',
      error:
        err instanceof Error
          ? `Tenant written but failed to load: ${err.message}`
          : 'Tenant written but failed to load.',
    }
  }
}

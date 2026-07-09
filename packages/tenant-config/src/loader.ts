import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import {
  DeclarativeTenantSchema,
  ThemeTokensSchema,
  type DeclarativeTenant,
  type ThemeTokens,
} from '@bevel/schema/declarative-tenant'

import { TenantSchema, type Tenant } from '@bevel/schema/tenant'

const moduleDir = dirname(fileURLToPath(import.meta.url))

export function resolveTenantsRoot(): string {
  const fallback = resolve(moduleDir, '../../../tenants')
  const fromEnv = process.env.BEVEL_TENANTS_ROOT
  if (!fromEnv) return fallback

  // Relative paths are cwd-sensitive (apps/web vs monorepo root). Prefer the
  // path that actually contains tenant folders.
  const candidates = [
    resolve(fromEnv),
    resolve(process.cwd(), fromEnv),
    resolve(process.cwd(), '../..', fromEnv),
    fallback,
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return fallback
}

export function tenantDir(slug: string, root = resolveTenantsRoot()): string {
  return join(root, slug)
}

export function tenantConfigPath(slug: string, root = resolveTenantsRoot()): string {
  return join(tenantDir(slug, root), 'bevel.yaml')
}

export function loadDeclarativeTenant(
  slug: string,
  root = resolveTenantsRoot(),
): DeclarativeTenant {
  const path = tenantConfigPath(slug, root)
  if (!existsSync(path)) {
    throw new Error(`Tenant config not found: ${path}`)
  }
  const raw = parseYaml(readFileSync(path, 'utf8'))
  return DeclarativeTenantSchema.parse(raw)
}

export function loadThemeTokens(
  declarative: DeclarativeTenant,
  root = resolveTenantsRoot(),
): ThemeTokens {
  const dir = tenantDir(declarative.tenant, root)
  const themePath = resolve(dir, declarative.brand.theme)
  if (!existsSync(themePath)) {
    throw new Error(`Theme file not found: ${themePath}`)
  }
  const raw = JSON.parse(readFileSync(themePath, 'utf8'))
  return ThemeTokensSchema.parse(raw)
}

function authModeToProviders(
  mode: DeclarativeTenant['auth']['mode'],
): Tenant['auth']['providers'] {
  switch (mode) {
    case 'magic-link':
      return ['credentials']
    case 'github':
      return ['github']
    case 'google':
      return ['google']
    case 'saml':
    case 'oidc':
      return ['credentials']
    default:
      return ['google']
  }
}

/** Compile declarative bevel.yaml → runtime Tenant contract. */
export function compileTenant(
  declarative: DeclarativeTenant,
  root = resolveTenantsRoot(),
): Tenant {
  let tokens: ThemeTokens = {
    accent: '#7c5cff',
    mode: 'dark',
  }
  const productName = declarative.brand.product_name
  try {
    tokens = loadThemeTokens(declarative, root)
  } catch {
    // doctor will surface theme issues
  }

  const host = declarative.domain.toLowerCase().split(':')[0]
  const logoPath = declarative.brand.logo
    ? resolve(tenantDir(declarative.tenant, root), declarative.brand.logo)
    : undefined

  return TenantSchema.parse({
    id: `tenant_${declarative.tenant}`,
    slug: declarative.tenant,
    name: declarative.name ?? declarative.tenant,
    host,
    status: 'active',
    auth: {
      providers: authModeToProviders(declarative.auth.mode),
      allowedEmailDomains: declarative.auth.allowed_domains,
      allowedEmails: declarative.auth.allowed_emails,
      defaultForDomains: declarative.auth.default_for_domains,
      requireGitHubForWork: declarative.auth.require_github_for_work,
    },
    features: {
      channels: declarative.features.channels,
      directMessages: declarative.features.direct_messages,
      agentDispatch: declarative.features.agent_dispatch,
      workMode: declarative.features.work_mode,
      customBranding: declarative.features.custom_branding,
    },
    theme: {
      accent: tokens.accent,
      background: tokens.background,
      surface: tokens.surface,
      surfaceRaised: tokens.surface_raised,
      text: tokens.text,
      textMuted: tokens.text_muted,
      border: tokens.border,
      fontSans: tokens.font_sans,
      mode: tokens.mode ?? 'dark',
      productName: productName ?? declarative.tenant,
      logoUrl: logoPath && existsSync(logoPath) ? `file://${logoPath}` : undefined,
    },
    realtime: {
      namespace: declarative.realtime.namespace,
      url: declarative.realtime.url,
    },
    workRepos: declarative.work_repos,
  })
}

export function listTenantSlugs(root = resolveTenantsRoot()): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root).filter((entry) => {
    const p = join(root, entry)
    return statSync(p).isDirectory() && existsSync(join(p, 'bevel.yaml'))
  })
}

export function loadCompiledTenant(slug: string, root = resolveTenantsRoot()): Tenant {
  return compileTenant(loadDeclarativeTenant(slug, root), root)
}
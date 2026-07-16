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

import {
  resolveFeatureSet,
  TenantSchema,
  type FeatureFlagId,
  type Tenant,
} from '@bevel/schema/tenant'

const moduleDir = dirname(fileURLToPath(import.meta.url))

export function resolveTenantsRoot(): string {
  const monorepoFallback = resolve(moduleDir, '../../../tenants')
  // Production Next (cwd=apps/web): prefer monorepo tenants next to deploy root
  const cwdFallbacks = [
    resolve(process.cwd(), 'tenants'),
    resolve(process.cwd(), '../../tenants'),
    resolve(process.cwd(), '../tenants'),
  ]
  const dataFallback = process.env.BEVEL_DATA_ROOT
    ? resolve(process.env.BEVEL_DATA_ROOT, 'tenants')
    : null

  const fromEnv = process.env.BEVEL_TENANTS_ROOT
  if (fromEnv) {
    // Relative paths are cwd-sensitive (apps/web vs monorepo root). Prefer the
    // path that actually contains tenant folders; otherwise return absolute so
    // claim can create it.
    const candidates = [
      resolve(fromEnv),
      resolve(process.cwd(), fromEnv),
      resolve(process.cwd(), '../..', fromEnv),
      monorepoFallback,
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    return resolve(fromEnv)
  }

  for (const candidate of [
    monorepoFallback,
    ...cwdFallbacks,
    dataFallback,
  ].filter(Boolean) as string[]) {
    if (existsSync(candidate)) return candidate
  }
  return monorepoFallback
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
  const slug = declarative.tenant
  const dir = tenantDir(slug, root)
  const logoPath = declarative.brand.logo
    ? resolve(dir, declarative.brand.logo)
    : undefined
  // Prefer public brand path so browsers can load the logo (not file://).
  // Files under apps/web/public/brand/{slug}/ are the served copies.
  const logoUrl =
    logoPath && existsSync(logoPath)
      ? `/brand/${slug}/logo.svg`
      : publicBrandLogoUrl(slug, null)

  const dayparts = ['morning', 'midday', 'afternoon', 'night'] as const
  const logoUrlsByDaypart: Partial<Record<(typeof dayparts)[number], string>> =
    {}
  for (const part of dayparts) {
    const declared = declarative.brand.logos?.[part]
    if (declared) {
      const abs = resolve(dir, declared)
      if (existsSync(abs)) {
        // Normalize to public path by daypart (upload API mirrors here)
        const ext = declared.split('.').pop()?.toLowerCase() || 'svg'
        logoUrlsByDaypart[part] = `/brand/${slug}/logo-${part}.${ext}`
        continue
      }
    }
    const publicUrl = publicBrandLogoUrl(slug, part)
    if (publicUrl) logoUrlsByDaypart[part] = publicUrl
  }

  let plan = declarative.plan ?? 'free'
  // Expired trial → free
  if (
    plan === 'trial' &&
    declarative.trial_ends_at &&
    new Date(declarative.trial_ends_at).getTime() < Date.now()
  ) {
    plan = 'free'
  }

  // Map snake_case YAML overrides → feature flag ids
  const f = declarative.features
  const overrides: Partial<Record<FeatureFlagId, boolean>> = {}
  const map: [keyof typeof f, FeatureFlagId][] = [
    ['channels', 'channels'],
    ['direct_messages', 'directMessages'],
    ['agent_dispatch', 'agentDispatch'],
    ['work_mode', 'workMode'],
    ['custom_branding', 'customBranding'],
    ['async_streams', 'asyncStreams'],
    ['live_sessions', 'liveSessions'],
    ['analytics', 'analytics'],
    ['live_media', 'liveMedia'],
    ['sms', 'sms'],
    ['otp_sms', 'otpSms'],
    ['presence_sms', 'presenceSms'],
    ['sso_saml', 'ssoSaml'],
    ['audit_log', 'auditLog'],
    ['dedicated_support', 'dedicatedSupport'],
    ['agent_memory', 'agentMemory'],
    ['voice_rooms', 'voiceRooms'],
    ['multi_region', 'multiRegion'],
  ]
  for (const [yamlKey, flagId] of map) {
    const v = f[yamlKey]
    if (typeof v === 'boolean') overrides[flagId] = v
  }

  const featureAccess = declarative.feature_access ?? 'stable'
  const featureSet = resolveFeatureSet({ plan, featureAccess, overrides })

  return TenantSchema.parse({
    id: `tenant_${slug}`,
    slug,
    name: declarative.name ?? slug,
    host,
    status: 'active',
    plan,
    featureAccess,
    trialEndsAt: declarative.trial_ends_at,
    auth: {
      providers: authModeToProviders(declarative.auth.mode),
      allowedEmailDomains: declarative.auth.allowed_domains,
      allowedEmails: declarative.auth.allowed_emails,
      defaultForDomains: declarative.auth.default_for_domains,
      requireGitHubForWork: declarative.auth.require_github_for_work,
    },
    features: {
      channels: featureSet.channels,
      directMessages: featureSet.directMessages,
      agentDispatch: featureSet.agentDispatch,
      workMode: featureSet.workMode,
      customBranding: featureSet.customBranding,
      sms: featureSet.sms,
      otpSms: featureSet.otpSms,
      presenceSms: featureSet.presenceSms,
      asyncStreams: featureSet.asyncStreams,
      liveSessions: featureSet.liveSessions,
      analytics: featureSet.analytics,
      liveMedia: featureSet.liveMedia,
      ssoSaml: featureSet.ssoSaml,
      auditLog: featureSet.auditLog,
      dedicatedSupport: featureSet.dedicatedSupport,
      agentMemory: featureSet.agentMemory,
      voiceRooms: featureSet.voiceRooms,
      multiRegion: featureSet.multiRegion,
    },
    featureSet,
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
      productName: productName ?? slug,
      logoUrl,
      markUrl: logoUrl,
      logoUrlsByDaypart:
        Object.keys(logoUrlsByDaypart).length > 0
          ? logoUrlsByDaypart
          : undefined,
    },
    realtime: {
      namespace: declarative.realtime.namespace,
      url: declarative.realtime.url,
    },
    workRepos: declarative.work_repos,
  })
}

const LOGO_EXTS = ['svg', 'png', 'webp', 'jpg', 'jpeg'] as const

/**
 * Resolve a served brand logo under apps/web/public/brand/{slug}/.
 * daypart null → logo.{ext}; otherwise logo-{daypart}.{ext}
 */
function publicBrandLogoUrl(
  slug: string,
  daypart: 'morning' | 'midday' | 'afternoon' | 'night' | null,
): string | undefined {
  // Resolve monorepo public brand dir from package location
  const candidates = [
    resolve(moduleDir, '../../../apps/web/public/brand', slug),
    resolve(process.cwd(), 'apps/web/public/brand', slug),
    resolve(process.cwd(), 'public/brand', slug),
  ]
  for (const brandDir of candidates) {
    if (!existsSync(brandDir)) continue
    for (const ext of LOGO_EXTS) {
      const name = daypart ? `logo-${daypart}.${ext}` : `logo.${ext}`
      if (existsSync(join(brandDir, name))) {
        return `/brand/${slug}/${name}`
      }
    }
  }
  return undefined
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
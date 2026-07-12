import { z } from 'zod'
import { TenantTransportsSchema } from './transport'

/** Customer-facing declarative config (bevel.yaml in tenants/{slug}/). */

export const DeclarativeAuthSchema = z.object({
  mode: z
    .enum(['magic-link', 'google', 'github', 'saml', 'oidc'])
    .default('google'),
  allowed_domains: z.array(z.string()).optional(),
  allowed_emails: z.array(z.string().email()).optional(),
  /**
   * When several tenants allow the same email domain (common in local multi-product
   * setups), these domains prefer this tenant as the home workspace after platform login.
   */
  default_for_domains: z.array(z.string()).optional(),
  require_github_for_work: z.boolean().default(false),
})

/** Optional per-daypart logo paths relative to the tenant dir (or public brand). */
export const DeclarativeDaypartLogosSchema = z.object({
  morning: z.string().optional(),
  midday: z.string().optional(),
  afternoon: z.string().optional(),
  night: z.string().optional(),
})

export const DeclarativeBrandSchema = z.object({
  /** Default / fallback logo (used when a daypart slot is empty). */
  logo: z.string().optional(),
  /**
   * Four unique day-part marks: morning, midday, afternoon, night.
   * Paths relative to tenants/{slug}/ (e.g. ./logos/logo-morning.svg).
   */
  logos: DeclarativeDaypartLogosSchema.optional(),
  theme: z.string().default('./theme.json'),
  product_name: z.string().optional(),
})

/**
 * Optional feature overrides (snake_case in YAML).
 * Omit a key to inherit the plan default from FEATURE_CATALOG.
 * `false` always disables; `true` only applies if plan meets the flag floor.
 */
export const DeclarativeFeaturesSchema = z.object({
  async_streams: z.boolean().optional(),
  live_sessions: z.boolean().optional(),
  analytics: z.boolean().optional(),
  channels: z.boolean().optional(),
  direct_messages: z.boolean().optional(),
  agent_dispatch: z.boolean().optional(),
  work_mode: z.boolean().optional(),
  custom_branding: z.boolean().optional(),
  live_media: z.boolean().optional(),
  sms: z.boolean().optional(),
  otp_sms: z.boolean().optional(),
  presence_sms: z.boolean().optional(),
  sso_saml: z.boolean().optional(),
  audit_log: z.boolean().optional(),
  dedicated_support: z.boolean().optional(),
  agent_memory: z.boolean().optional(),
  voice_rooms: z.boolean().optional(),
  multi_region: z.boolean().optional(),
})

export const DeclarativeRealtimeSchema = z.object({
  namespace: z.string().regex(/^[a-z0-9-]+$/),
  presence: z.boolean().default(true),
  url: z.string().url().optional(),
})

export const DeclarativeDeploymentSchema = z.object({
  preview_url: z.string().url().optional(),
  production_url: z.string().url().optional(),
  target: z.enum(['vercel', 'cloudflare', 'custom']).default('vercel'),
})

export const DeclarativeTenantSchema = z.object({
  tenant: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().optional(),
  domain: z.string().min(1),
  /** Additional hostnames (preview, staging, apex aliases) */
  hosts: z.array(z.string()).optional(),
  /**
   * Product plan. free | trial | pro | team | enterprise
   * Feature flags resolve from plan + feature_access + optional overrides.
   */
  plan: z.enum(['free', 'trial', 'pro', 'team', 'enterprise']).default('free'),
  /**
   * Release pipeline access: stable (GA only) | beta | upcoming.
   * Orthogonal to plan — a free tenant on beta still cannot get paid flags.
   */
  feature_access: z.enum(['stable', 'beta', 'upcoming']).default('stable'),
  /** ISO end of trial (when plan is trial). */
  trial_ends_at: z.string().datetime().optional(),
  brand: DeclarativeBrandSchema.default({}),
  features: DeclarativeFeaturesSchema.default({}),
  auth: DeclarativeAuthSchema.default({}),
  realtime: DeclarativeRealtimeSchema,
  transports: TenantTransportsSchema.optional(),
  deployment: DeclarativeDeploymentSchema.optional(),
  work_repos: z.array(z.string()).default([]),
})

export type DeclarativeTenant = z.infer<typeof DeclarativeTenantSchema>
export type DeclarativeBrand = z.infer<typeof DeclarativeBrandSchema>
export type DeclarativeFeatures = z.infer<typeof DeclarativeFeaturesSchema>
export type DeclarativeAuth = z.infer<typeof DeclarativeAuthSchema>
export type DeclarativeRealtime = z.infer<typeof DeclarativeRealtimeSchema>

/** Theme tokens file referenced by brand.theme */
export const ThemeTokensSchema = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7c5cff'),
  background: z.string().optional(),
  surface: z.string().optional(),
  surface_raised: z.string().optional(),
  text: z.string().optional(),
  text_muted: z.string().optional(),
  border: z.string().optional(),
  font_sans: z.string().optional(),
  font_mono: z.string().optional(),
  radius: z.string().optional(),
  mode: z.enum(['light', 'dark']).default('dark'),
})

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>
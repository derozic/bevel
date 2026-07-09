import { z } from 'zod'
import { TenantTransportsSchema } from './transport'

/** Customer-facing declarative config (bevel.yaml in tenants/{slug}/). */

export const DeclarativeAuthSchema = z.object({
  mode: z
    .enum(['magic-link', 'google', 'github', 'saml', 'oidc'])
    .default('google'),
  allowed_domains: z.array(z.string()).optional(),
  allowed_emails: z.array(z.string().email()).optional(),
  require_github_for_work: z.boolean().default(false),
})

export const DeclarativeBrandSchema = z.object({
  logo: z.string().optional(),
  theme: z.string().default('./theme.json'),
  product_name: z.string().optional(),
})

export const DeclarativeFeaturesSchema = z.object({
  async_streams: z.boolean().default(true),
  live_sessions: z.boolean().default(true),
  analytics: z.boolean().default(true),
  channels: z.boolean().default(true),
  direct_messages: z.boolean().default(true),
  agent_dispatch: z.boolean().default(true),
  work_mode: z.boolean().default(false),
  custom_branding: z.boolean().default(false),
  /** WebRTC audio/video — separate feature module */
  live_media: z.boolean().default(false),
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
  text: z.string().optional(),
  font_sans: z.string().optional(),
  font_mono: z.string().optional(),
  radius: z.string().optional(),
})

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>
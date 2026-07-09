import { z } from 'zod'

export const TenantAuthPolicySchema = z.object({
  providers: z.array(z.enum(['google', 'github', 'credentials'])).default(['google']),
  allowedEmailDomains: z.array(z.string()).optional(),
  allowedEmails: z.array(z.string().email()).optional(),
  /** Domains that route to this tenant first after platform (bevel.lvh.me) login. */
  defaultForDomains: z.array(z.string()).optional(),
  requireGitHubForWork: z.boolean().default(false),
})

export const TenantFeaturesSchema = z.object({
  channels: z.boolean().default(true),
  directMessages: z.boolean().default(true),
  agentDispatch: z.boolean().default(true),
  workMode: z.boolean().default(false),
  customBranding: z.boolean().default(false),
})

export const TenantThemeSchema = z.object({
  accent: z.string().default('#7c5cff'),
  background: z.string().optional(),
  surface: z.string().optional(),
  surfaceRaised: z.string().optional(),
  text: z.string().optional(),
  textMuted: z.string().optional(),
  border: z.string().optional(),
  fontSans: z.string().optional(),
  mode: z.enum(['light', 'dark']).default('dark'),
  logoUrl: z.string().url().optional(),
  markUrl: z.string().url().optional(),
  productName: z.string().optional(),
})

export const TenantRealtimeSchema = z.object({
  namespace: z.string().min(1),
  url: z.string().url().optional(),
})

export const TenantSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  host: z.string().min(1),
  status: z.enum(['active', 'pending', 'suspended']).default('active'),
  auth: TenantAuthPolicySchema.default({}),
  features: TenantFeaturesSchema.default({}),
  theme: TenantThemeSchema.default({}),
  realtime: TenantRealtimeSchema,
  workRepos: z.array(z.string()).default([]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export type Tenant = z.infer<typeof TenantSchema>
export type TenantAuthPolicy = z.infer<typeof TenantAuthPolicySchema>
export type TenantFeatures = z.infer<typeof TenantFeaturesSchema>
export type TenantTheme = z.infer<typeof TenantThemeSchema>
export type TenantRealtime = z.infer<typeof TenantRealtimeSchema>
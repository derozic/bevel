import { z } from 'zod'

/** Gradient stop — sRGB hex always; optional Display P3 channels for wide-gamut screens. */
export const announcementGradientStopSchema = z.object({
  /** sRGB fallback, e.g. #f5c518 */
  color: z.string().min(1),
  /**
   * Display P3 channels as "R G B" in 0–1 range (no alpha), e.g. "1 0.82 0.12".
   * Rendered as color(display-p3 R G B) when the browser supports it.
   */
  p3: z
    .string()
    .regex(/^[\d.]+\s+[\d.]+\s+[\d.]+$/)
    .optional(),
  /** Position 0–100; omitted stops distribute evenly */
  at: z.number().min(0).max(100).optional(),
})

export const announcementStyleSchema = z.object({
  /** Foreground text / icon color (sRGB hex) */
  textColor: z.string().default('#1a1200'),
  /** Optional muted link underline color */
  linkColor: z.string().optional(),
  /** CTA pill button colors (when ctaVariant is button) */
  ctaBg: z.string().optional(),
  ctaText: z.string().optional(),
  ctaBorder: z.string().optional(),
  /** Circular icon badge background */
  iconBg: z.string().optional(),
  iconColor: z.string().optional(),
  gradient: z.object({
    angleDeg: z.number().min(0).max(360).default(90),
    stops: z.array(announcementGradientStopSchema).min(2).max(8),
  }),
})

export const announcementLinkKindSchema = z.enum(['app', 'external'])
export const announcementCtaVariantSchema = z.enum(['link', 'button'])
/** Where the bar sits in the product shell */
export const announcementPlacementSchema = z.enum(['top', 'bottom'])
/**
 * Dynamic next-step banners resolve copy from member state (profile / integrations).
 * Static banners use `static` (default).
 */
export const announcementKindSchema = z.enum(['static', 'next_step'])
export const announcementAudienceSchema = z.enum([
  'all',
  'authenticated',
  'operators',
])

/**
 * Curated Heroicons outline names (PascalCase without the Icon suffix is accepted
 * as kebab/camel too — resolve on the client).
 * @see https://heroicons.com
 */
export const ANNOUNCEMENT_ICON_IDS = [
  'device-phone-mobile',
  'device-tablet',
  'computer-desktop',
  'sparkles',
  'shield-check',
  'bell-alert',
  'megaphone',
  'rocket-launch',
  'cloud-arrow-down',
  'qr-code',
  'information-circle',
  'exclamation-triangle',
  'check-circle',
  'link',
  'user-group',
  'cpu-chip',
] as const

export type AnnouncementIconId = (typeof ANNOUNCEMENT_ICON_IDS)[number]

export const announcementSchema = z.object({
  id: z.string().min(1),
  /** Bold lead-in, e.g. "Action may be required:" */
  title: z.string().default(''),
  body: z.string().min(1),
  /** Heroicon id, e.g. device-phone-mobile */
  icon: z.string().default(''),
  linkLabel: z.string().default('Learn more'),
  /**
   * App path (`/download`) or absolute URL when linkKind is external.
   */
  linkHref: z.string().min(1),
  linkKind: announcementLinkKindSchema.default('app'),
  /** Inline text link vs pill CTA button (screenshot style) */
  ctaVariant: announcementCtaVariantSchema.default('link'),
  /** Shell placement — one promo at top, one action strip at bottom is the default product layout */
  placement: announcementPlacementSchema.default('top'),
  /** `next_step` rewrites body/href from profile + integrations completeness */
  kind: announcementKindSchema.default('static'),
  dismissible: z.boolean().default(true),
  enabled: z.boolean().default(true),
  /** Higher shows first when multiple active (per placement) */
  priority: z.number().int().default(0),
  audience: announcementAudienceSchema.default('all'),
  /** Empty / omit = platform-wide; otherwise only these tenant slugs */
  tenantSlugs: z.array(z.string()).default([]),
  style: announcementStyleSchema,
  startsAt: z.string().datetime().optional().or(z.literal('')).optional(),
  endsAt: z.string().datetime().optional().or(z.literal('')).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const announcementCreateSchema = announcementSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial({
    title: true,
    icon: true,
    linkLabel: true,
    linkKind: true,
    ctaVariant: true,
    placement: true,
    kind: true,
    dismissible: true,
    enabled: true,
    priority: true,
    audience: true,
    tenantSlugs: true,
  })
  .required({ body: true, linkHref: true, style: true })

export const announcementUpdateSchema = announcementCreateSchema.partial()

export type Announcement = z.infer<typeof announcementSchema>
export type AnnouncementStyle = z.infer<typeof announcementStyleSchema>
export type AnnouncementGradientStop = z.infer<
  typeof announcementGradientStopSchema
>
export type AnnouncementCreate = z.infer<typeof announcementCreateSchema>
export type AnnouncementUpdate = z.infer<typeof announcementUpdateSchema>
export type AnnouncementCtaVariant = z.infer<typeof announcementCtaVariantSchema>
export type AnnouncementPlacement = z.infer<typeof announcementPlacementSchema>
export type AnnouncementKind = z.infer<typeof announcementKindSchema>

/** Amber warning strip — rich P3 golds on capable displays. */
export const DEFAULT_ANNOUNCEMENT_STYLE: AnnouncementStyle = {
  textColor: '#1a1200',
  linkColor: '#1a1200',
  gradient: {
    angleDeg: 92,
    stops: [
      { color: '#f6c84a', p3: '0.97 0.78 0.2', at: 0 },
      { color: '#efb020', p3: '0.95 0.68 0.1', at: 45 },
      { color: '#f0c040', p3: '0.96 0.74 0.16', at: 100 },
    ],
  },
}

/** Soft ice bar like mobile-app promo screenshots */
export const SOFT_SKY_ANNOUNCEMENT_STYLE: AnnouncementStyle = {
  textColor: '#1f2937',
  linkColor: '#1f2937',
  ctaBg: '#ffffff',
  ctaText: '#1f2937',
  ctaBorder: 'rgba(15, 23, 42, 0.14)',
  iconBg: '#dbeafe',
  iconColor: '#2563eb',
  gradient: {
    angleDeg: 90,
    stops: [
      { color: '#e8f6ff', p3: '0.91 0.96 1', at: 0 },
      { color: '#dff2ff', p3: '0.88 0.94 1', at: 50 },
      { color: '#d4edff', p3: '0.84 0.92 1', at: 100 },
    ],
  },
}

export const ANNOUNCEMENT_STYLE_PRESETS: Record<
  string,
  { label: string; style: AnnouncementStyle }
> = {
  soft_sky: {
    label: 'Soft sky (promo)',
    style: SOFT_SKY_ANNOUNCEMENT_STYLE,
  },
  amber: {
    label: 'Amber alert',
    style: DEFAULT_ANNOUNCEMENT_STYLE,
  },
  info: {
    label: 'Info sky',
    style: {
      textColor: '#0a1628',
      linkColor: '#0a1628',
      ctaBg: '#ffffff',
      ctaText: '#0a1628',
      ctaBorder: 'rgba(10, 22, 40, 0.16)',
      iconBg: '#bae6fd',
      iconColor: '#0369a1',
      gradient: {
        angleDeg: 95,
        stops: [
          { color: '#7dd3fc', p3: '0.55 0.82 0.98', at: 0 },
          { color: '#38bdf8', p3: '0.32 0.72 0.95', at: 50 },
          { color: '#0ea5e9', p3: '0.15 0.62 0.9', at: 100 },
        ],
      },
    },
  },
  success: {
    label: 'Success mint',
    style: {
      textColor: '#052e16',
      linkColor: '#052e16',
      ctaBg: '#ffffff',
      ctaText: '#052e16',
      ctaBorder: 'rgba(5, 46, 22, 0.16)',
      iconBg: '#bbf7d0',
      iconColor: '#15803d',
      gradient: {
        angleDeg: 100,
        stops: [
          { color: '#6ee7b7', p3: '0.48 0.9 0.7', at: 0 },
          { color: '#34d399', p3: '0.3 0.82 0.58', at: 55 },
          { color: '#10b981', p3: '0.18 0.72 0.5', at: 100 },
        ],
      },
    },
  },
  danger: {
    label: 'Critical rose',
    style: {
      textColor: '#fff5f5',
      linkColor: '#fff5f5',
      ctaBg: 'rgba(255,255,255,0.18)',
      ctaText: '#fff5f5',
      ctaBorder: 'rgba(255,255,255,0.35)',
      iconBg: 'rgba(255,255,255,0.2)',
      iconColor: '#fff5f5',
      gradient: {
        angleDeg: 88,
        stops: [
          { color: '#f43f5e', p3: '0.92 0.28 0.38', at: 0 },
          { color: '#e11d48', p3: '0.85 0.15 0.3', at: 50 },
          { color: '#be123c', p3: '0.72 0.1 0.24', at: 100 },
        ],
      },
    },
  },
  brand: {
    label: 'Brand violet (P3)',
    style: {
      textColor: '#f8f5ff',
      linkColor: '#f8f5ff',
      ctaBg: 'rgba(255,255,255,0.16)',
      ctaText: '#f8f5ff',
      ctaBorder: 'rgba(255,255,255,0.32)',
      iconBg: 'rgba(255,255,255,0.18)',
      iconColor: '#f8f5ff',
      gradient: {
        angleDeg: 110,
        stops: [
          { color: '#8b5cf6', p3: '0.52 0.35 0.95', at: 0 },
          { color: '#a855f7', p3: '0.64 0.32 0.95', at: 40 },
          { color: '#ec4899', p3: '0.9 0.3 0.6', at: 100 },
        ],
      },
    },
  },
}

export const ANNOUNCEMENT_ICON_LABELS: Record<string, string> = {
  'device-phone-mobile': 'Phone',
  'device-tablet': 'Tablet',
  'computer-desktop': 'Desktop',
  sparkles: 'Sparkles',
  'shield-check': 'Shield',
  'bell-alert': 'Bell',
  megaphone: 'Megaphone',
  'rocket-launch': 'Rocket',
  'cloud-arrow-down': 'Download',
  'qr-code': 'QR code',
  'information-circle': 'Info',
  'exclamation-triangle': 'Warning',
  'check-circle': 'Check',
  link: 'Link',
  'user-group': 'People',
  'cpu-chip': 'Chip',
}

/** Build CSS background-image with sRGB fallback + display-p3 when supported. */
export function announcementGradientCss(
  style: AnnouncementStyle,
): { srgb: string; p3: string } {
  const angle = style.gradient.angleDeg
  const srgbStops = style.gradient.stops
    .map((s) => {
      const pos = s.at != null ? ` ${s.at}%` : ''
      return `${s.color}${pos}`
    })
    .join(', ')
  const p3Stops = style.gradient.stops
    .map((s) => {
      const pos = s.at != null ? ` ${s.at}%` : ''
      const col = s.p3 ? `color(display-p3 ${s.p3})` : s.color
      return `${col}${pos}`
    })
    .join(', ')
  return {
    srgb: `linear-gradient(${angle}deg, ${srgbStops})`,
    p3: `linear-gradient(${angle}deg, ${p3Stops})`,
  }
}

export function isAnnouncementActive(
  a: Announcement,
  now = new Date(),
): boolean {
  if (!a.enabled) return false
  if (a.startsAt) {
    const start = new Date(a.startsAt)
    if (!Number.isNaN(start.getTime()) && now < start) return false
  }
  if (a.endsAt) {
    const end = new Date(a.endsAt)
    if (!Number.isNaN(end.getTime()) && now > end) return false
  }
  return true
}

export function filterAnnouncementsForTenant(
  items: Announcement[],
  tenantSlug?: string | null,
): Announcement[] {
  return items
    .filter((a) => isAnnouncementActive(a))
    .filter((a) => {
      if (!a.tenantSlugs || a.tenantSlugs.length === 0) return true
      if (!tenantSlug) return false
      return a.tenantSlugs.includes(tenantSlug)
    })
    .sort((x, y) => y.priority - x.priority || y.updatedAt.localeCompare(x.updatedAt))
}

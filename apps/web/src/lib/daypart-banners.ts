import type { AnnouncementBarStyle } from '@bevel/ui'
import type { DaypartId } from '@/lib/daypart'

/**
 * Banner atmospheres trained per day part.
 * - promo  → top strip (Flutter / soft product message)
 * - action → bottom strip (next-step / may be required)
 */
export const DAYPART_BANNER_STYLES: Record<
  DaypartId,
  { promo: AnnouncementBarStyle; action: AnnouncementBarStyle }
> = {
  morning: {
    promo: {
      textColor: '#3d2914',
      linkColor: '#3d2914',
      ctaBg: '#fffaf5',
      ctaText: '#3d2914',
      ctaBorder: 'rgba(61, 41, 20, 0.14)',
      iconBg: 'rgba(232, 140, 60, 0.22)',
      iconColor: '#c45a12',
      gradient: {
        angleDeg: 95,
        stops: [
          { color: '#fff0e0', p3: '1 0.94 0.88', at: 0 },
          { color: '#ffe4c8', p3: '1 0.9 0.8', at: 50 },
          { color: '#ffd9b0', p3: '1 0.86 0.72', at: 100 },
        ],
      },
    },
    action: {
      textColor: '#2a1808',
      linkColor: '#2a1808',
      ctaBg: '#fff8f0',
      ctaText: '#2a1808',
      ctaBorder: 'rgba(42, 24, 8, 0.16)',
      iconBg: 'rgba(200, 90, 20, 0.2)',
      iconColor: '#9a3f0a',
      gradient: {
        angleDeg: 92,
        stops: [
          { color: '#f6b24a', p3: '0.96 0.7 0.28', at: 0 },
          { color: '#ef9a28', p3: '0.93 0.6 0.16', at: 45 },
          { color: '#f0a838', p3: '0.94 0.66 0.22', at: 100 },
        ],
      },
    },
  },
  midday: {
    promo: {
      textColor: '#0a1f33',
      linkColor: '#0a1f33',
      ctaBg: '#ffffff',
      ctaText: '#0a1f33',
      ctaBorder: 'rgba(10, 31, 51, 0.14)',
      iconBg: 'rgba(14, 165, 233, 0.18)',
      iconColor: '#0369a1',
      gradient: {
        angleDeg: 90,
        stops: [
          { color: '#e8f6ff', p3: '0.91 0.96 1', at: 0 },
          { color: '#dff2ff', p3: '0.88 0.94 1', at: 50 },
          { color: '#d4edff', p3: '0.84 0.92 1', at: 100 },
        ],
      },
    },
    action: {
      textColor: '#0c1a28',
      linkColor: '#0c1a28',
      ctaBg: '#f0f9ff',
      ctaText: '#0c1a28',
      ctaBorder: 'rgba(12, 26, 40, 0.14)',
      iconBg: 'rgba(2, 132, 199, 0.2)',
      iconColor: '#075985',
      gradient: {
        angleDeg: 92,
        stops: [
          { color: '#38bdf8', p3: '0.32 0.72 0.95', at: 0 },
          { color: '#0ea5e9', p3: '0.15 0.62 0.9', at: 50 },
          { color: '#28b4f0', p3: '0.22 0.68 0.92', at: 100 },
        ],
      },
    },
  },
  afternoon: {
    promo: {
      textColor: '#2c1a0a',
      linkColor: '#2c1a0a',
      ctaBg: '#fffbf5',
      ctaText: '#2c1a0a',
      ctaBorder: 'rgba(44, 26, 10, 0.14)',
      iconBg: 'rgba(217, 119, 6, 0.18)',
      iconColor: '#b45309',
      gradient: {
        angleDeg: 98,
        stops: [
          { color: '#fff4e5', p3: '1 0.96 0.9', at: 0 },
          { color: '#ffe8c8', p3: '1 0.91 0.8', at: 55 },
          { color: '#ffd9a8', p3: '1 0.86 0.68', at: 100 },
        ],
      },
    },
    action: {
      textColor: '#1f1408',
      linkColor: '#1f1408',
      ctaBg: '#fff7ed',
      ctaText: '#1f1408',
      ctaBorder: 'rgba(31, 20, 8, 0.16)',
      iconBg: 'rgba(180, 83, 9, 0.22)',
      iconColor: '#9a3412',
      gradient: {
        angleDeg: 92,
        stops: [
          { color: '#f6c84a', p3: '0.97 0.78 0.2', at: 0 },
          { color: '#efb020', p3: '0.95 0.68 0.1', at: 45 },
          { color: '#f0c040', p3: '0.96 0.74 0.16', at: 100 },
        ],
      },
    },
  },
  night: {
    // Soft navy promo — true navy blue, no purple/violet cast
    promo: {
      textColor: '#d6e4f5',
      linkColor: '#d6e4f5',
      ctaBg: 'rgba(255, 255, 255, 0.1)',
      ctaText: '#e8f0fa',
      ctaBorder: 'rgba(214, 228, 245, 0.2)',
      iconBg: 'rgba(96, 165, 250, 0.22)',
      iconColor: '#93c5fd',
      gradient: {
        angleDeg: 105,
        stops: [
          { color: '#0f1c30', p3: '0.06 0.11 0.18', at: 0 },
          { color: '#152640', p3: '0.09 0.14 0.24', at: 45 },
          { color: '#122038', p3: '0.07 0.12 0.21', at: 100 },
        ],
      },
    },
    // Bottom action strip: same navy family as promo (not school-bus yellow)
    action: {
      textColor: '#e4eefc',
      linkColor: '#f0f6ff',
      ctaBg: 'rgba(255, 255, 255, 0.12)',
      ctaText: '#f0f6ff',
      ctaBorder: 'rgba(228, 238, 252, 0.22)',
      iconBg: 'rgba(96, 165, 250, 0.2)',
      iconColor: '#bfdbfe',
      gradient: {
        angleDeg: 95,
        stops: [
          { color: '#143056', p3: '0.09 0.18 0.32', at: 0 },
          { color: '#1a3d68', p3: '0.11 0.23 0.39', at: 40 },
          { color: '#122c50', p3: '0.08 0.16 0.3', at: 100 },
        ],
      },
    },
  },
}

export function bannerStyleForDaypart(
  daypart: DaypartId,
  role: 'promo' | 'action',
): AnnouncementBarStyle {
  return structuredClone(DAYPART_BANNER_STYLES[daypart][role])
}

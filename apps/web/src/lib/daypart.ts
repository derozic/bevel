import type { DaypartId, DaypartPreference } from '@bevel/schema'

export type { DaypartId, DaypartPreference }

/**
 * Atmosphere tokens tenant chrome may set as inline styles on <body>.
 * Day part must clear these so html[data-daypart] CSS can own contrast training.
 */
export const DAYPART_ATMOSPHERE_KEYS = [
  '--cream',
  '--ink',
  '--surface',
  '--border',
  '--sticker-muted',
  '--sticker-subtle',
  '--bevel-bg',
  '--bevel-surface',
  '--bevel-surface-raised',
  '--bevel-text',
  '--bevel-text-muted',
  '--bevel-border',
  // Accent is part of daypart training (tenant accent still on --tenant-accent)
  '--bevel-accent',
  '--bevel-accent-muted',
  '--command-accent',
] as const

/** Four clock-driven atmospheres (no storm mode in BEVEL). */
export function getDaypartFromHour(hour: number): DaypartId {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 15) return 'midday'
  if (hour >= 15 && hour < 20) return 'afternoon'
  return 'night'
}

export function resolveDaypart(
  preference: DaypartPreference = 'auto',
  date = new Date(),
): DaypartId {
  if (preference !== 'auto') return preference
  return getDaypartFromHour(date.getHours())
}

/**
 * Apply resolved day part to the document.
 * Clears body-level atmosphere overrides so trained CSS wins over tenant chrome.
 */
export function applyDaypartAtmosphere(
  preference: DaypartPreference = 'auto',
  date = new Date(),
): DaypartId {
  const part = resolveDaypart(preference, date)
  if (typeof document === 'undefined') return part

  const root = document.documentElement
  root.dataset.daypart = part
  root.dataset.daypartPreference = preference

  const body = document.body
  if (body) {
    for (const key of DAYPART_ATMOSPHERE_KEYS) {
      body.style.removeProperty(key)
    }
  }

  // Map Tailwind @theme consumers that read --color-* from bevel tokens
  root.style.setProperty('--color-background', 'var(--bevel-bg)')
  root.style.setProperty('--color-surface', 'var(--bevel-surface)')
  root.style.setProperty('--color-surface-raised', 'var(--bevel-surface-raised)')
  root.style.setProperty('--color-border', 'var(--bevel-border)')
  root.style.setProperty('--color-foreground', 'var(--bevel-text)')
  root.style.setProperty('--color-muted', 'var(--bevel-text-muted)')
  root.style.setProperty('--color-accent', 'var(--bevel-accent)')

  return part
}

export const DAYPART_META: Record<
  DaypartId,
  {
    label: string
    shortLabel: string
    hours: string
    greeting: string
    training: string
  }
> = {
  morning: {
    label: 'Morning',
    shortLabel: 'AM',
    hours: '5:00 – 11:00',
    greeting: 'Clear light, soft contrast — ease into the day.',
    training:
      'Warm cream base, peach-amber accent, readable ink without harsh black. Surfaces stay airy; borders whisper.',
  },
  midday: {
    label: 'Midday',
    shortLabel: 'Noon',
    hours: '11:00 – 15:00',
    greeting: 'Peak clarity — cool light, crisp structure.',
    training:
      'Cool white base, cyan-sky accent, strong but calm contrast. Surfaces are clean paper; focus is on content.',
  },
  afternoon: {
    label: 'Afternoon',
    shortLabel: 'PM',
    hours: '15:00 – 20:00',
    greeting: 'Golden hour warmth as the day slopes down.',
    training:
      'Honey-cream base, amber-gold accent, slightly deeper ink. Soft glow on active rows without muddy greys.',
  },
  night: {
    label: 'Night',
    shortLabel: 'Eve',
    hours: '20:00 – 5:00',
    greeting: 'Low-luminance navy — easy on eyes.',
    training:
      'Deep navy surface (oklch hue ~232–235 blue, not 250+ purple), cool sky-blue accent. Promo + action banners share the navy family. Avoid pure #000; keep borders subtle but present.',
  },
}

export const DAYPART_ORDER: DaypartId[] = [
  'morning',
  'midday',
  'afternoon',
  'night',
]

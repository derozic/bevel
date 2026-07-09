import type { Tenant } from '@bevel/schema'

type CssVarMap = Record<string, string>

/** Map tenant theme → CSS variables for BEVEL + 2x4m-compatible chat tokens (--cream, --ink). */
export function tenantThemeCssVars(tenant: Tenant | null): CssVarMap {
  if (!tenant) return {}

  const t = tenant.theme
  const accent = t.accent ?? '#7c5cff'
  const background = t.background ?? (t.mode === 'light' ? '#faf8f5' : '#0c0c0e')
  const surface = t.surface ?? (t.mode === 'light' ? '#ffffff' : '#141418')
  const text = t.text ?? (t.mode === 'light' ? '#1a1410' : '#f4f4f5')
  const textMuted = t.textMuted ?? (t.mode === 'light' ? '#5c534c' : '#a1a1aa')
  const border = t.border ?? text

  return {
    '--tenant-accent': accent,
    '--bevel-accent': accent,
    '--bevel-accent-muted': `color-mix(in srgb, ${accent} 70%, #000)`,
    '--bevel-bg': background,
    '--bevel-surface': surface,
    '--bevel-surface-raised': t.surfaceRaised ?? surface,
    '--bevel-border': border,
    '--bevel-text': text,
    '--bevel-text-muted': textMuted,
    '--bevel-font-sans': t.fontSans ?? 'Inter, ui-sans-serif, system-ui, sans-serif',
    '--cream': background,
    '--ink': text,
    '--surface': surface,
    '--border': border,
    '--sticker-muted': textMuted,
    '--sticker-subtle': textMuted,
    '--command-accent': accent,
  }
}
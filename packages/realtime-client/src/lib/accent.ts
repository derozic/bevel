/** Darkened accent stripes — ≥3:1 contrast on white/cream (WCAG 1.4.11). */
const STRIPE_ON_LIGHT: Record<string, string> = {
  '#f59e0b': '#b45309',
  '#6366f1': '#4338ca',
  '#ea580c': '#c2410c',
  '#22c55e': '#15803d',
  '#7c3aed': '#5b21b6',
  '#0ea5e9': '#0369a1',
  '#ec4899': '#be185d',
  '#059669': '#047857',
  '#0d9488': '#0f766e',
}

export function accentStripeColor(accent?: string): string | undefined {
  if (!accent) return undefined
  const key = accent.trim().toLowerCase()
  return STRIPE_ON_LIGHT[key] ?? accent
}
/** Bevel-friendly categorical palette (works on cream/night surfaces). */
export const BEVEL_CHART_PALETTE = [
  '#7c5cff',
  '#38bdf8',
  '#f59e0b',
  '#22c55e',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#ef4444',
  '#64748b',
] as const

export function colorAt(i: number, override?: string): string {
  if (override) return override
  return BEVEL_CHART_PALETTE[i % BEVEL_CHART_PALETTE.length]!
}
